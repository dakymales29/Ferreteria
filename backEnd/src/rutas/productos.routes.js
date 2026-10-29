import { Router } from "express";
import pool from "../db/db.js";

const router = Router();

// GET - Obtener productos
router.get('/productos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener los productos" });
    }
});

// GET - Valor total del inventario (al costo y a pvp)
router.get('/productos/valor-inventario', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                SUM(stock_actual * precio_costo) AS valor_total_costo,
                SUM(stock_actual * pvp) AS valor_total_pvp,
                COUNT(*) AS total_productos
            FROM productos
        `);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al calcular el valor del inventario" });
    }
});

// GET - Productos bajo stock mínimo
router.get('/productos/bajo-stock', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM productos WHERE stock_actual <= stock_minimo ORDER BY stock_actual ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al obtener productos bajo stock" });
    }
});

// POST - Crear producto
router.post('/productos', async (req, res) => {
    try {
        let { codigo, nombre, categoria, proveedor, stock_actual, stock_minimo, precio_costo, pvp } = req.body;

        if (!nombre) {
            return res.status(400).json({ mensaje: "El nombre del producto es obligatorio ⚠️" });
        }

        // Si no mandas código, se crea solito y en orden automáticamente
        if (!codigo || codigo.trim() === '') {
            const countResult = await pool.query('SELECT COUNT(*) FROM productos');
            const siguienteNum = parseInt(countResult.rows[0].count) + 1;
            codigo = `PROD-${String(siguienteNum).padStart(4, '0')}`;
        }

        const result = await pool.query(
            `INSERT INTO productos (codigo, nombre, categoria, proveedor, stock_actual, stock_minimo, precio_costo, pvp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [codigo, nombre, categoria || null, proveedor || null, stock_actual || 0, stock_minimo || 5, precio_costo || 0, pvp || 0]
        );

        res.status(201).json({
            mensaje: "Producto creado exitosamente 🚀",
            producto: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al crear el producto" });
    }
});

// PUT - Actualizar producto
router.put('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, categoria, proveedor, stock_actual, stock_minimo, precio_costo, pvp } = req.body;

        const result = await pool.query(
            `UPDATE productos 
             SET codigo = $1, nombre = $2, categoria = $3, proveedor = $4, stock_actual = $5, stock_minimo = $6, precio_costo = $7, pvp = $8
             WHERE id = $9
             RETURNING *`,
            [codigo, nombre, categoria, proveedor, stock_actual, stock_minimo, precio_costo, pvp, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Producto no encontrado ❌" });
        }

        res.json({
            mensaje: "Producto actualizado correctamente 🚀",
            producto: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al actualizar el producto" });
    }
});

// DELETE - Eliminar producto
router.delete('/productos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: "Producto no encontrado ❌" });
        }

        res.json({
            mensaje: "Producto eliminado correctamente 🗑️",
            productoEliminado: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: "Error al eliminar el producto" });
    }
});

export default router;