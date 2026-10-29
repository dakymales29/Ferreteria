import { Router } from "express";
import pool from "../db/db.js";

const router = Router();

// =======================
// GET - OBTENER VENTAS
// =======================
router.get('/ventas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ventas ORDER BY fecha_transaccion DESC');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ mensaje: "ERROR AL OBTENER VENTAS" });
    }
});

// =======================
// POST - CREAR VENTA (Con Transacción, Validación y Resta de Stock Actual)
// =======================
router.post('/ventas', async (req, res) => {
    const client = await pool.connect();

    try {
        const { 
            numero_venta_dia, 
            usuario_id, 
            subtotal, 
            aplica_iva, 
            porcentaje_iva_usado, 
            monto_iva, 
            total, 
            items 
        } = req.body; 
        // items esperado: [{ producto_id, cantidad, precio_unitario, subtotal }]

        if (!items || items.length === 0 || total === undefined) {
            return res.status(400).json({ 
                mensaje: "La venta debe tener un total y al menos un producto ⚠️" 
            });
        }

        await client.query('BEGIN');

        // 1. Insertar la cabecera de la venta con tus campos exactos
        const ventaQuery = `
            INSERT INTO ventas (numero_venta_dia, usuario_id, subtotal, aplica_iva, porcentaje_iva_usado, monto_iva, total)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id;
        `;
        const ventaResult = await client.query(ventaQuery, [
            numero_venta_dia || 1, 
            usuario_id || null, 
            subtotal, 
            aplica_iva || false, 
            porcentaje_iva_usado || 0, 
            monto_iva || 0, 
            total
        ]);
        const ventaId = ventaResult.rows[0].id;

        // 2. Recorrer los ítems, verificar stock_actual y restar inventario
        for (const item of items) {
            const { producto_id, cantidad, precio_unitario, subtotal: subItem } = item;

            // Verificar producto usando 'stock_actual'
            const stockCheck = await client.query(
                `SELECT stock_actual, nombre FROM productos WHERE id = $1`, 
                [producto_id]
            );

            if (stockCheck.rows.length === 0) {
                throw new Error(`El producto con ID ${producto_id} no existe ❌`);
            }

            const productoActual = stockCheck.rows[0];

            if (Number(productoActual.stock_actual) < Number(cantidad)) {
                throw new Error(`Stock insuficiente para "${productoActual.nombre}". Disponibles: ${productoActual.stock_actual} ⚠️`);
            }

            // Guardar en detalle_ventas
            await client.query(
                `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [ventaId, producto_id, cantidad, precio_unitario, subItem || (cantidad * precio_unitario)]
            );

            // Restar usando 'stock_actual'
            await client.query(
                `UPDATE productos 
                 SET stock_actual = stock_actual - $1 
                 WHERE id = $2`,
                [cantidad, producto_id]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: "Venta registrada con éxito y stock actualizado 🚀",
            venta_id: ventaId
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error.message);
        res.status(400).json({ mensaje: error.message || "Error al procesar la venta" });
    } finally {
        client.release();
    }
});

// =======================
// PUT - ACTUALIZAR VENTA (Cabecera)
// =======================
router.put('/ventas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { total, subtotal, monto_iva } = req.body;

        if (total === undefined) {
            return res.status(400).json({ mensaje: "El total es obligatorio para actualizar ⚠️" });
        }

        const result = await pool.query(
            `UPDATE ventas 
             SET total = $1, subtotal = $2, monto_iva = $3 
             WHERE id = $4 
             RETURNING *`,
            [total, subtotal || 0, monto_iva || 0, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Venta no encontrada ❌" });
        }

        res.json({
            mensaje: "Venta actualizada correctamente 🚀",
            venta: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al actualizar la venta" });
    }
});

// =======================
// DELETE - ANULAR VENTA Y REVERTIR STOCK (Usando stock_actual)
// =======================
router.delete('/ventas/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query('BEGIN');

        const detalleResult = await client.query(
            `SELECT producto_id, cantidad FROM detalle_ventas WHERE venta_id = $1`,
            [id]
        );

        if (detalleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: "Venta no encontrada ❌" });
        }

        // Devolver stock a stock_actual
        for (const item of detalleResult.rows) {
            await client.query(
                `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
                [item.cantidad, item.producto_id]
            );
        }

        await client.query(`DELETE FROM detalle_ventas WHERE venta_id = $1`, [id]);
        const ventaDelete = await client.query(`DELETE FROM ventas WHERE id = $1 RETURNING *`, [id]);

        await client.query('COMMIT');

        res.json({
            mensaje: "Venta anulada y stock devuelto correctamente 🗑️🔄",
            ventaEliminada: ventaDelete.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ mensaje: "Error al anular la venta" });
    } finally {
        client.release();
    }
});

export default router;