import XLSX from 'xlsx';
import pool from '../src/db/db.js'; // Ajusta la ruta si tu db.js está en otra carpeta dentro de src

const migrarDatos = async () => {
  try {
    console.log('📂 Leyendo el archivo Excel...');
    const workbook = XLSX.readFile('./src/FERRETERIA DON VILLA  (2)-1.xlsx');
    const sheetNames = workbook.SheetNames;
    
    console.log(`Hojas encontradas en el Excel: ${sheetNames.join(', ')}`);

    let totalProductosMigrados = 0;

    for (const sheetName of sheetNames) {
      console.log(`\n--- Procesando hoja: ${sheetName} ---`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (data.length === 0) continue;

      let categoriaActual = sheetName; // Por defecto la categoría es el nombre de la hoja
      let encabezadosIndex = -1;
      let colProveedor = -1;
      let colProducto = -1;
      let colStock = -1;
      let colCosto = -1;
      let colPvp = -1;

      // 1. Detectar la fila de encabezados y mapear columnas según la hoja
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowString = row.map(cell => String(cell || '').toUpperCase()).join(' ');

        if (rowString.includes('PRODUCTO') || rowString.includes('MATERIAL')) {
          encabezadosIndex = i;
          // Identificar índices de columnas basándose en los textos de los encabezados
          row.forEach((cell, idx) => {
            const val = String(cell || '').toUpperCase();
            if (val.includes('PROVEEDOR')) colProveedor = idx;
            if (val.includes('PRODUCTO') || val.includes('MATERIAL')) colProducto = idx;
            if (val.includes('STOCK')) colStock = idx;
            if (val.includes('P. DISTRI') || val.includes('PRECIO PROVEDOR') || val.includes('P. DISTRIBUIDOR')) colCosto = idx;
            if (val.includes('P.V.P') || val.includes('P. V.P') || val.includes('PVP')) colPvp = idx;
          });
          break;
        }
      }

      if (encabezadosIndex === -1) {
        console.log(`⚠️ No se encontraron encabezados claros en la hoja ${sheetName}, omitiendo...`);
        continue;
      }

      // 2. Recorrer las filas de datos debajo de los encabezados
      for (let i = encabezadosIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        // Detectar si la fila es una subcategoría (ej: "PEGABLES" en accesorios)
        // Por lo general, la subcategoría aparece en la primera o segunda columna y el resto está vacío
        const primeraCol = String(row[1] || row[0] || '').trim();
        const esFilaVacia = row.every(cell => cell === undefined || cell === null || String(cell).trim() === '');
        
        if (esFilaVacia) continue;

        // Si es una fila de título/subcategoría (ej. solo tiene texto en la primera columna y no tiene stock ni precio)
        const tieneValoresNumericos = row.some(cell => typeof cell === 'number' || (!isNaN(parseFloat(cell)) && String(cell).trim() !== ''));
        if (!tieneValoresNumericos && primeraCol.length > 0) {
          categoriaActual = `${sheetName} - ${primeraCol.toUpperCase()}`;
          continue;
        }

        // Extraer valores con seguridad
        const proveedor = colProveedor !== -1 && row[colProveedor] ? String(row[colProveedor]).trim() : 'VARIOS';
        const nombreProducto = colProducto !== -1 && row[colProducto] ? String(row[colProducto]).trim() : null;

        if (!nombreProducto) continue; // Si no hay nombre de producto, saltar

        // Limpiar stock (si no hay, por defecto 0)
        let stock = 0;
        if (colStock !== -1 && row[colStock] !== undefined) {
          const parsedStock = parseFloat(row[colStock]);
          if (!isNaN(parsedStock)) stock = parsedStock;
        }

        // Limpiar precio de costo (P. Distribuidor)
        let precioCosto = 0.00;
        if (colCosto !== -1 && row[colCosto] !== undefined) {
          const costoStr = String(row[colCosto]).split('/')[0].trim(); // Por si viene en formato "18.61 / 0.19"
          const parsedCosto = parseFloat(costoStr);
          if (!isNaN(parsedCosto)) precioCosto = parsedCosto;
        }

        // Limpiar PVP
        let pvp = 0.00;
        if (colPvp !== -1 && row[colPvp] !== undefined) {
          const pvpStr = String(row[colPvp]).split('/')[0].replace('m', '').trim(); // Limpieza básica de textos
          const parsedPvp = parseFloat(pvpStr);
          if (!isNaN(parsedPvp)) pvp = parsedPvp;
        }

        // Extraer código si existe (ej. hoja Tornillos)
        let codigo = `PROD-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;
        if (sheetName === 'TORNILLOS' && row[0]) {
          codigo = String(row[0]).trim();
        }

        // 3. Insertar en PostgreSQL
        const query = `
          INSERT INTO productos (codigo, nombre, categoria, proveedor, stock_actual, precio_costo, pvp)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        
        const values = [codigo, nombreProducto, categoriaActual, proveedor, stock, precioCosto, pvp];

        await pool.query(query, values);
        totalProductosMigrados++;
      }
    }

    console.log(`\n🎉 ¡Migración completada con éxito! Se registraron ${totalProductosMigrados} productos en la base de datos.`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error durante la migración del Excel:', error);
    process.exit(1);
  }
};

migrarDatos();