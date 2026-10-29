<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// --- ESTADOS NAVEGACIÓN LOCAL ---
const vistaActiva = ref('pos') // 'pos' | 'historial'

// --- ESTADOS VENTA (POS) ---
const productos = ref([])
const carrito = ref([])
const busqueda = ref('')
const cargando = ref(false)
const mensajeExito = ref('')
const errorMsg = ref('')

// Configuración y IVA
const porcentajeIvaConfig = ref(15.00)
const aplicaIva = ref(true)
const efectivoRecibido = ref(0)

// --- ESTADOS HISTORIAL Y FILTRO DE FECHA ---
const historialVentas = ref([])
const cargandoHistorial = ref(false)

// --- ESTADOS PAGINACIÓN HISTORIAL ---
const paginaActual = ref(1)
const itemsPorPagina = ref(10)

// Fecha actual en formato YYYY-MM-DD para el input type="date" por defecto
const obtenerFechaHoy = () => {
  const hoy = new Date()
  return hoy.toISOString().split('T')[0]
}
const fechaFiltro = ref(obtenerFechaHoy())

// Resetear a la página 1 cuando cambie el filtro de fecha
watch(fechaFiltro, () => {
  paginaActual.value = 1
})

// --- CARGAR DATOS INICIALES ---
const obtenerDatosIniciales = async () => {
  try {
    cargando.value = true
    
    // 1. Productos
    const resProd = await fetch('http://localhost:3000/api/productos')
    if (resProd.ok) {
      const dataProd = await resProd.json()
      productos.value = Array.isArray(dataProd) ? dataProd : []
    }

    // 2. Configuración (IVA)
    const resConfig = await fetch('http://localhost:3000/api/configuracion')
    if (resConfig.ok) {
      const dataConfig = await resConfig.json()
      const config = Array.isArray(dataConfig) ? dataConfig[0] : dataConfig
      if (config && config.porcentaje_iva !== undefined) {
        porcentajeIvaConfig.value = parseFloat(config.porcentaje_iva)
      }
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'Aviso: No se pudo conectar completamente con el servidor.'
  } finally {
    cargando.value = false
  }
}

// --- OBTENER HISTORIAL DE VENTAS ---
const obtenerHistorial = async () => {
  try {
    cargandoHistorial.value = true
    const res = await fetch('http://localhost:3000/api/ventas')
    if (!res.ok) throw new Error('Error al obtener historial')
    const data = await res.json()
    historialVentas.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error(err)
    errorMsg.value = 'No se pudo obtener el historial de ventas.'
  } finally {
    cargandoHistorial.value = false
  }
}

const cambiarVista = (vista) => {
  vistaActiva.value = vista
  if (vista === 'historial') {
    obtenerHistorial()
  }
}

onMounted(() => {
  obtenerDatosIniciales()
})

// --- FILTRAR HISTORIAL POR LA FECHA SELECCIONADA ---
const historialFiltradoPorFecha = computed(() => {
  if (!fechaFiltro.value) return historialVentas.value
  
  return historialVentas.value.filter(v => {
    if (!v.fecha_transaccion) return false
    const fechaVenta = v.fecha_transaccion.split('T')[0]
    return fechaVenta === fechaFiltro.value
  })
})

// --- PAGINACIÓN PARA LA VISTA EN PANTALLA ---
const totalPaginas = computed(() => {
  return Math.ceil(historialFiltradoPorFecha.value.length / itemsPorPagina.value) || 1
})

const historialPaginado = computed(() => {
  const inicio = (paginaActual.value - 1) * itemsPorPagina.value
  const fin = inicio + itemsPorPagina.value
  return historialFiltradoPorFecha.value.slice(inicio, fin)
})

// --- FORMATO DE MONEDA Y FECHA ---
const formatearMoneda = (valor) => {
  const numero = parseFloat(valor || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero)
}

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return 'N/A'
  const fecha = new Date(fechaStr)
  return fecha.toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

// --- FILTRAR PRODUCTOS PARA EL BUSCADOR DE VENTAS ---
const productosSugeridos = computed(() => {
  const query = busqueda.value.toLowerCase().trim()
  if (!query) return []
  return productos.value.filter(p => {
    const nombre = p.nombre ? String(p.nombre).toLowerCase() : ''
    const codigo = p.codigo || p.id ? String(p.codigo || p.id).toLowerCase() : ''
    return nombre.includes(query) || codigo.includes(query)
  }).slice(0, 5)
})

// --- GESTIÓN DEL CARRITO ---
const agregarAlCarrito = (producto) => {
  const stockDispo = parseInt(producto.stock_actual || 0)
  if (stockDispo <= 0) {
    alert('⚠️ Este producto no tiene stock disponible.')
    return
  }

  const itemExistente = carrito.value.find(item => item.id === producto.id)
  if (itemExistente) {
    if (itemExistente.cantidad + 1 > stockDispo) {
      alert('⚠️ No puedes agregar más de la cantidad disponible en stock.')
      return
    }
    itemExistente.cantidad++
  } else {
    carrito.value.push({
      id: producto.id,
      codigo: producto.codigo || producto.id,
      nombre: producto.nombre,
      precio: parseFloat(producto.pvp || 0),
      cantidad: 1,
      stockMaximo: stockDispo
    })
  }
  busqueda.value = ''
}

const cambiarCantidad = (item, delta) => {
  const nuevaCantidad = item.cantidad + delta
  if (nuevaCantidad <= 0) {
    removerItem(item.id)
  } else if (nuevaCantidad > item.stockMaximo) {
    alert('⚠️ Stock máximo alcanzado.')
  } else {
    item.cantidad = nuevaCantidad
  }
}

const removerItem = (id) => {
  carrito.value = carrito.value.filter(item => item.id !== id)
}

// --- CÁLCULOS FINANCIEROS ---
const subtotalVenta = computed(() => {
  return carrito.value.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
})

const montoIvaCalculado = computed(() => {
  if (!aplicaIva.value) return 0
  return Math.round((subtotalVenta.value * (porcentajeIvaConfig.value / 100)) * 100) / 100
})

const totalVenta = computed(() => {
  return Math.round((subtotalVenta.value + montoIvaCalculado.value) * 100) / 100
})

const cambioVuelto = computed(() => {
  const recibido = parseFloat(efectivoRecibido.value) || 0
  const total = totalVenta.value
  return recibido >= total ? Math.round((recibido - total) * 100) / 100 : 0
})

// --- PROCESAR VENTA ---
const procesarVenta = async () => {
  if (carrito.value.length === 0) return

  const recibido = parseFloat(efectivoRecibido.value) || 0
  const totalPagar = totalVenta.value

  if (recibido < totalPagar) {
    alert('⚠️ El efectivo recibido es menor al total con IVA incluido.')
    return
  }

  try {
    cargando.value = true
    errorMsg.value = ''
    mensajeExito.value = ''

    const payload = {
      subtotal: subtotalVenta.value,
      aplica_iva: aplicaIva.value,
      porcentaje_iva_usado: aplicaIva.value ? porcentajeIvaConfig.value : 0.00,
      monto_iva: montoIvaCalculado.value,
      total: totalPagar,
      items: carrito.value.map(item => ({
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cantidad
      }))
    }

    const res = await fetch('http://localhost:3000/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('Error al registrar la venta en el servidor')

    mensajeExito.value = '¡Venta registrada con éxito! Stock e impuestos guardados.'
    carrito.value = []
    efectivoRecibido.value = 0
    obtenerDatosIniciales()

    setTimeout(() => { mensajeExito.value = '' }, 4000)

  } catch (err) {
    console.error(err)
    errorMsg.value = 'Hubo un error al procesar la venta en la base de datos.'
  } finally {
    cargando.value = false
  }
}

// --- ANULAR VENTA ---
const anularVenta = async (id) => {
  if (!confirm(`¿Estás seguro de anular la Venta #${id}? El stock devuelto regresará al inventario.`)) return

  try {
    cargandoHistorial.value = true
    const res = await fetch(`http://localhost:3000/api/ventas/${id}`, {
      method: 'DELETE'
    })

    if (!res.ok) throw new Error('No se pudo anular la venta')

    mensajeExito.value = `Venta #${id} anulada correctamente y stock devuelto.`
    obtenerHistorial()
    obtenerDatosIniciales()

    setTimeout(() => { mensajeExito.value = '' }, 4000)
  } catch (err) {
    console.error(err)
    alert('❌ Error al anular la venta.')
  } finally {
    cargandoHistorial.value = false
  }
}

// --- IMPRIMIR / DESCARGAR REPORTE DEL DÍA ---
const imprimirReporteDia = () => {
  window.print()
}
// --- CERRAR SESIÓN ---
const handleLogout = () => {
  localStorage.removeItem('usuario_pos')
  router.push('/login')
}
</script>

<template>
  <div class="flex min-h-screen bg-gray-900 text-gray-100">
    
    <!-- BARRA LATERAL -->
    <aside class="w-64 bg-gray-800 p-6 flex flex-col justify-between border-r border-gray-700 shrink-0 print:hidden">
      <div>
        <div class="flex items-center space-x-3 mb-8">
          <span class="text-3xl">🛠️</span>
          <h1 class="text-xl font-bold text-yellow-400">Don Villa</h1>
        </div>

        <nav class="space-y-3">
          <router-link to="/inventario" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
            <span>📦</span>
            <span>Inventario</span>
          </router-link>
          <router-link to="/ventas" class="flex items-center space-x-3 p-3 rounded-lg bg-yellow-500 text-gray-900 font-semibold shadow">
            <span>🛒</span>
            <span>Ventas</span>
          </router-link>
          <router-link to="/compras" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
            <span>🚚</span>
            <span>Compras</span>
          </router-link>
          <router-link to="/configuracion" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
            <span>⚙️</span>
            <span>Configuración</span>
          </router-link>
        </nav>
      </div>
       <!-- BOTÓN LOGOUT + VERSIÓN -->
      <div class="space-y-4">
        <button 
          @click="handleLogout"
          class="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm"
        >
          <span>🚪</span>
          <span>Cerrar Sesión</span>
        </button>
        <div class="text-xs text-gray-500 text-center">Ferretería Don Villa v1.0</div>
      </div>

      
    </aside>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="flex-1 p-6 md:p-8 overflow-y-auto">
      
      <!-- ENCABEZADO Y PESTAÑAS (Oculto al imprimir) -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h2 class="text-2xl md:text-3xl font-extrabold text-white">Módulo de Ventas</h2>
          <p class="text-gray-400 mt-1 text-sm md:text-base">Registra transacciones o consulta el historial de facturación.</p>
        </div>

        <!-- Pestañas POS / Historial -->
        <div class="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
          <button 
            @click="cambiarVista('pos')"
            :class="vistaActiva === 'pos' ? 'bg-yellow-500 text-gray-900 font-bold' : 'text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm transition flex items-center space-x-2"
          >
            <span>🛒</span>
            <span>Nueva Venta</span>
          </button>
          <button 
            @click="cambiarVista('historial')"
            :class="vistaActiva === 'historial' ? 'bg-yellow-500 text-gray-900 font-bold' : 'text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm transition flex items-center space-x-2"
          >
            <span>📜</span>
            <span>Historial</span>
          </button>
        </div>
      </div>

      <!-- MENSAJES -->
      <div v-if="errorMsg" class="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm print:hidden">
        <span>⚠️ {{ errorMsg }}</span>
      </div>
      <div v-if="mensajeExito" class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl mb-6 text-sm print:hidden">
        <span>✅ {{ mensajeExito }}</span>
      </div>

      <!-- VISTA 1: PUNTO DE VENTA (POS) -->
      <div v-if="vistaActiva === 'pos'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- BUSCADOR Y CARRITO -->
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg relative">
            <label class="block text-sm font-medium text-gray-400 mb-2">Buscar producto para agregar</label>
            <div class="relative">
              <input 
                v-model="busqueda"
                type="text" 
                placeholder="Escribe el nombre o código del producto..." 
                class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500 transition"
              />
              <span class="absolute left-3 top-3 text-gray-400">🔍</span>
            </div>

            <!-- Sugerencias -->
            <div v-if="productosSugeridos.length > 0" class="absolute left-5 right-5 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden divide-y divide-gray-800">
              <div 
                v-for="p in productosSugeridos" 
                :key="p.id"
                @click="agregarAlCarrito(p)"
                class="p-3 hover:bg-gray-800 cursor-pointer flex justify-between items-center transition"
              >
                <div>
                  <p class="font-semibold text-white text-sm">{{ p.nombre }}</p>
                  <p class="text-xs text-gray-400 font-mono">Código: {{ p.codigo || p.id }} | Stock: {{ p.stock_actual }}</p>
                </div>
                <div class="text-emerald-400 font-bold text-sm">
                  {{ formatearMoneda(p.pvp) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Carrito -->
          <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5">
            <h3 class="text-lg font-bold text-white mb-4">Productos en la Venta</h3>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm text-gray-300">
                <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-700">
                  <tr>
                    <th class="py-3 px-3">Producto</th>
                    <th class="py-3 px-3">Precio U.</th>
                    <th class="py-3 px-3 text-center">Cantidad</th>
                    <th class="py-3 px-3">Subtotal</th>
                    <th class="py-3 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-700/60">
                  <tr v-for="item in carrito" :key="item.id" class="hover:bg-gray-700/30">
                    <td class="py-3 px-3 font-semibold text-white">{{ item.nombre }}</td>
                    <td class="py-3 px-3 text-gray-400">{{ formatearMoneda(item.precio) }}</td>
                    <td class="py-3 px-3 text-center">
                      <div class="inline-flex items-center space-x-2 bg-gray-900 px-2 py-1 rounded-lg border border-gray-700">
                        <button @click="cambiarCantidad(item, -1)" class="text-gray-400 hover:text-white px-1">-</button>
                        <span class="font-bold text-white w-6 text-center">{{ item.cantidad }}</span>
                        <button @click="cambiarCantidad(item, 1)" class="text-gray-400 hover:text-white px-1">+</button>
                      </div>
                    </td>
                    <td class="py-3 px-3 font-bold text-emerald-400">{{ formatearMoneda(item.precio * item.cantidad) }}</td>
                    <td class="py-3 px-3 text-center">
                      <button @click="removerItem(item.id)" class="text-red-400 hover:text-red-300 text-xs font-semibold bg-red-500/10 px-2 py-1 rounded">Quitar</button>
                    </td>
                  </tr>
                  <tr v-if="carrito.length === 0">
                    <td colspan="5" class="text-center py-8 text-gray-500">
                      No hay productos agregados a la venta actual.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- COBRO Y TOTALES -->
        <div class="space-y-6">
          <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6 flex flex-col justify-between">
            <div>
              <h3 class="text-lg font-bold text-white mb-4 pb-2 border-b border-gray-700">Resumen de Cobro</h3>
              
              <div class="bg-gray-900 p-3 rounded-lg border border-gray-700 mb-4 flex items-center justify-between">
                <label for="checkIva" class="text-sm font-medium text-gray-300 cursor-pointer flex items-center space-x-2">
                  <span>Aplicar IVA ({{ porcentajeIvaConfig }}%)</span>
                </label>
                <input 
                  id="checkIva"
                  v-model="aplicaIva"
                  type="checkbox" 
                  class="w-4 h-4 accent-yellow-500 cursor-pointer"
                />
              </div>

              <div class="space-y-2 text-sm mb-6 pb-4 border-b border-gray-700">
                <div class="flex justify-between text-gray-400">
                  <span>Subtotal:</span>
                  <span class="text-white font-semibold">{{ formatearMoneda(subtotalVenta) }}</span>
                </div>
                <div class="flex justify-between text-gray-400" v-if="aplicaIva">
                  <span>IVA ({{ porcentajeIvaConfig }}%):</span>
                  <span class="text-yellow-400 font-semibold">+ {{ formatearMoneda(montoIvaCalculado) }}</span>
                </div>
                <div class="flex justify-between text-xl font-extrabold text-white pt-2">
                  <span>Total a Pagar:</span>
                  <span class="text-emerald-400">{{ formatearMoneda(totalVenta) }}</span>
                </div>
              </div>

              <div class="space-y-2 mb-6">
                <label class="block text-sm font-medium text-gray-400">Efectivo Recibido ($)</label>
                <input 
                  v-model="efectivoRecibido"
                  type="number" 
                  step="0.01"
                  min="0"
                  class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-lg font-bold focus:outline-none focus:border-yellow-500 transition"
                />
              </div>

              <div class="bg-gray-900 p-4 rounded-xl border border-gray-700 mb-6 flex justify-between items-center">
                <span class="text-sm font-medium text-gray-400">Cambio (Vuelto):</span>
                <span class="text-xl font-bold text-yellow-400">{{ formatearMoneda(cambioVuelto) }}</span>
              </div>
            </div>

            <button 
              @click="procesarVenta"
              :disabled="carrito.length === 0 || cargando"
              class="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-4 rounded-xl transition shadow-lg text-center"
            >
              {{ cargando ? 'Procesando...' : 'Completar Venta 💰' }}
            </button>
          </div>
        </div>

      </div>

      <!-- VISTA 2: HISTORIAL DE VENTAS CON PAGINACIÓN EN PANTALLA Y PDF COMPLETO -->
      <div v-if="vistaActiva === 'historial'" class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6">
        
        <!-- CONTROLES SUPERIORES DEL HISTORIAL (Ocultos al imprimir) -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
          <div>
            <h3 class="text-lg font-bold text-white">Historial de Transacciones</h3>
            <p class="text-xs text-gray-400 mt-0.5">Mostrando ventas filtradas por la fecha seleccionada.</p>
          </div>

          <div class="flex items-center space-x-3 w-full md:w-auto">
            <!-- Selector de fecha -->
            <div class="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5">
              <span class="text-xs text-gray-400">📅 Fecha:</span>
              <input 
                v-model="fechaFiltro" 
                type="date" 
                class="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <!-- Botón Imprimir/Guardar PDF -->
            <button 
              @click="imprimirReporteDia" 
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            >
              <span>📥</span>
              <span>Guardar PDF / Imprimir</span>
            </button>
          </div>
        </div>

        <!-- ENCABEZADO EXCLUSIVO PARA IMPRESIÓN PDF -->
        <div class="hidden print:block mb-6 text-center border-b border-gray-300 pb-4">
          <h1 class="text-2xl font-bold text-black">Ferretería Don Villa</h1>
          <p class="text-sm text-gray-600">Reporte Diario de Ventas - Fecha: {{ fechaFiltro }}</p>
        </div>

        <!-- TABLA -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300 print:text-black whitespace-nowrap">
            <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-700 print:bg-gray-100 print:text-black">
              <tr>
                <th class="py-3 px-4"># Venta</th>
                <th class="py-3 px-4">Fecha y Hora</th>
                <th class="py-3 px-4">Subtotal</th>
                <th class="py-3 px-4">IVA Aplicado</th>
                <th class="py-3 px-4">Total</th>
                <th class="py-3 px-4 text-center print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700/60 print:divide-gray-300">
              <tr v-if="cargandoHistorial">
                <td colspan="6" class="text-center py-8 text-yellow-400 print:text-black">
                  Cargando historial de ventas... ⏳
                </td>
              </tr>

              <!-- FILAS EN PANTALLA: Usa 'historialPaginado' (máximo 10 por página) -->
              <tr v-for="v in historialPaginado" :key="v.id" class="hover:bg-gray-700/35 print:hidden">
                <td class="py-3.5 px-4 font-mono font-bold text-yellow-400">#{{ v.id }}</td>
                <td class="py-3.5 px-4 text-gray-300">{{ formatearFecha(v.fecha_transaccion) }}</td>
                <td class="py-3.5 px-4 text-gray-400">{{ formatearMoneda(v.subtotal) }}</td>
                <td class="py-3.5 px-4">
                  <span v-if="v.aplica_iva" class="text-yellow-400 font-medium">
                    {{ formatearMoneda(v.monto_iva) }} ({{ v.porcentaje_iva_usado }}%)
                  </span>
                  <span v-else class="text-gray-500 text-xs">Sin IVA</span>
                </td>
                <td class="py-3.5 px-4 font-bold text-emerald-400">{{ formatearMoneda(v.total) }}</td>
                <td class="py-3.5 px-4 text-center">
                  <button 
                    @click="anularVenta(v.id)" 
                    class="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1 rounded-lg transition font-medium"
                  >
                    🗑️ Anular
                  </button>
                </td>
              </tr>

              <!-- FILAS EXCLUSIVAS PARA IMPRESIÓN PDF: Muestra 'historialFiltradoPorFecha' COMPLETO sin paginación -->
              <template v-for="v in historialFiltradoPorFecha" :key="'print-'+v.id">
                <tr class="hidden print:table-row">
                  <td class="py-2.5 px-4 font-mono font-bold text-black">#{{ v.id }}</td>
                  <td class="py-2.5 px-4 text-black">{{ formatearFecha(v.fecha_transaccion) }}</td>
                  <td class="py-2.5 px-4 text-black">{{ formatearMoneda(v.subtotal) }}</td>
                  <td class="py-2.5 px-4 text-black">
                    <span v-if="v.aplica_iva">{{ formatearMoneda(v.monto_iva) }} ({{ v.porcentaje_iva_usado }}%)</span>
                    <span v-else>Sin IVA</span>
                  </td>
                  <td class="py-2.5 px-4 font-bold text-black">{{ formatearMoneda(v.total) }}</td>
                </tr>
              </template>

              <tr v-if="!cargandoHistorial && historialFiltradoPorFecha.length === 0">
                <td colspan="6" class="text-center py-8 text-gray-500">
                  No hay ventas registradas para la fecha seleccionada ({{ fechaFiltro }}).
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- CONTROLES DE PAGINACIÓN EN PANTALLA (Se ocultan al imprimir) -->
        <div v-if="totalPaginas > 1" class="flex justify-between items-center mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 print:hidden">
          <span>Página <strong class="text-white">{{ paginaActual }}</strong> de <strong class="text-white">{{ totalPaginas }}</strong></span>
          
          <div class="flex space-x-2">
            <button 
              @click="paginaActual--" 
              :disabled="paginaActual === 1"
              class="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
            >
              ◀ Anterior
            </button>
            <button 
              @click="paginaActual++" 
              :disabled="paginaActual === totalPaginas"
              class="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
            >
              Siguiente ▶
            </button>
          </div>
        </div>

      </div>

    </main>
  </div>
</template>