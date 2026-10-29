<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// --- ESTADOS NAVEGACIÓN LOCAL ---
const vistaActiva = ref('nueva') // 'nueva' | 'historial'

// --- ESTADOS REGISTRO DE COMPRA ---
const productos = ref([])
const carritoCompra = ref([])
const busqueda = ref('')
const proveedor = ref('')
const cargando = ref(false)
const mensajeExito = ref('')
const errorMsg = ref('')

// --- ESTADOS MODAL PRODUCTO NUEVO ---
const mostrarModalNuevo = ref(false)
const cargandoNuevoProd = ref(false)
const nuevoProducto = ref({
  codigo: '',
  nombre: '',
  categoria: 'General',
  precio_costo: 0,
  pvp: 0,
  stock_minimo: 5
})

// --- ESTADOS HISTORIAL ---
const historialCompras = ref([])
const cargandoHistorial = ref(false)

// --- ESTADOS PAGINACIÓN HISTORIAL ---
const paginaActual = ref(1)
const itemsPorPagina = ref(10)

const obtenerFechaHoy = () => new Date().toISOString().split('T')[0]
const fechaFiltro = ref(obtenerFechaHoy())

// Resetear a la página 1 cuando cambie el filtro de fecha
watch(fechaFiltro, () => {
  paginaActual.value = 1
})

// --- CARGAR PRODUCTOS INICIALES ---
const obtenerProductos = async () => {
  try {
    cargando.value = true
    const res = await fetch('https://ferreteria-back-end.onrender.com/api/productos')
    if (res.ok) {
      const data = await res.json()
      productos.value = Array.isArray(data) ? data : []
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'No se pudo conectar con el servidor para cargar productos.'
  } finally {
    cargando.value = false
  }
}

// --- OBTENER HISTORIAL DE COMPRAS ---
const obtenerHistorial = async () => {
  try {
    cargandoHistorial.value = true
    const res = await fetch('https://ferreteria-back-end.onrender.com/api/compras')
    if (!res.ok) throw new Error('Error al obtener compras')
    const data = await res.json()
    historialCompras.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error(err)
    errorMsg.value = 'No se pudo cargar el historial de compras.'
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
  obtenerProductos()
})

// --- FORMATO Y FILTROS ---
const formatearMoneda = (valor) => {
  const numero = parseFloat(valor || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(numero)
}

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return 'N/A'
  const fecha = new Date(fechaStr)
  return fecha.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}

const productosSugeridos = computed(() => {
  const query = busqueda.value.toLowerCase().trim()
  if (!query) return []
  return productos.value.filter(p => {
    const nombre = p.nombre ? String(p.nombre).toLowerCase() : ''
    const codigo = p.codigo || p.id ? String(p.codigo || p.id).toLowerCase() : ''
    return nombre.includes(query) || codigo.includes(query)
  }).slice(0, 5)
})

const historialFiltradoPorFecha = computed(() => {
  if (!fechaFiltro.value) return historialCompras.value
  return historialCompras.value.filter(c => {
    if (!c.fecha_transaccion) return false
    return c.fecha_transaccion.split('T')[0] === fechaFiltro.value
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

// --- GESTIÓN DEL CARRITO DE COMPRA ---
const agregarAlCarrito = (producto) => {
  const itemExistente = carritoCompra.value.find(item => item.id === producto.id)
  if (itemExistente) {
    itemExistente.cantidad++
  } else {
    carritoCompra.value.push({
      id: producto.id,
      nombre: producto.nombre,
      stockActual: parseInt(producto.stock_actual || 0),
      precioCosto: parseFloat(producto.precio_costo || 0),
      cantidad: 1
    })
  }
  busqueda.value = ''
}

const removerItem = (id) => {
  carritoCompra.value = carritoCompra.value.filter(item => item.id !== id)
}

const totalCompra = computed(() => {
  return carritoCompra.value.reduce((acc, item) => acc + (item.precioCosto * item.cantidad), 0)
})

// --- CREAR PRODUCTO NUEVO EN LA BD Y AGREGAR AL CARRITO ---
const crearNuevoProducto = async () => {
  if (!nuevoProducto.value.nombre.trim()) {
    alert('Por favor ponle un nombre al producto.')
    return
  }

  try {
    cargandoNuevoProd.value = true
    
    const payload = {
      ...nuevoProducto.value,
      codigo: nuevoProducto.value.codigo.trim() || null,
      stock_actual: 0 
    }

    const res = await fetch('https://ferreteria-back-end.onrender.com/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('Error al crear el producto')

    const data = await res.json()
    const prodCreado = data.producto

    await obtenerProductos()
    agregarAlCarrito(prodCreado)

    mostrarModalNuevo.value = false
    nuevoProducto.value = {
      codigo: '',
      nombre: '',
      categoria: 'General',
      precio_costo: 0,
      pvp: 0,
      stock_minimo: 5
    }

    mensajeExito.value = `¡Producto "${prodCreado.nombre}" (${prodCreado.codigo}) creado y añadido!`
    setTimeout(() => { mensajeExito.value = '' }, 4000)

  } catch (err) {
    console.error(err)
    alert('❌ Error al crear el nuevo producto.')
  } finally {
    cargandoNuevoProd.value = false
  }
}

// --- PROCESAR COMPRA ---
const procesarCompra = async () => {
  if (carritoCompra.value.length === 0) return

  try {
    cargando.value = true
    errorMsg.value = ''
    mensajeExito.value = ''

    const payload = {
      proveedor: proveedor.value.trim() || 'Proveedor General',
      total: totalCompra.value,
      items: carritoCompra.value.map(item => ({
        producto_id: item.id,
        cantidad: item.cantidad,
        precio_unitario: item.precioCosto,
        subtotal: item.precioCosto * item.cantidad
      }))
    }

    const res = await fetch('https://ferreteria-back-end.onrender.com/api/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('Error al registrar la compra')

    mensajeExito.value = '¡Compra registrada correctamente y stock actualizado! 🚀'
    carritoCompra.value = []
    proveedor.value = ''
    obtenerProductos()

    setTimeout(() => { mensajeExito.value = '' }, 4000)

  } catch (err) {
    console.error(err)
    errorMsg.value = 'Hubo un error al registrar la compra en la base de datos.'
  } finally {
    cargando.value = false
  }
}

// --- ANULAR COMPRA ---
const anularCompra = async (id) => {
  if (!confirm(`¿Estás seguro de anular la Compra #${id}? El stock ingresado se restará del inventario.`)) return

  try {
    cargandoHistorial.value = true
    const res = await fetch(`https://ferreteria-back-end.onrender.com/api/compras/${id}`, {
      method: 'DELETE'
    })

    if (!res.ok) throw new Error('No se pudo anular la compra')

    mensajeExito.value = `Compra #${id} eliminada y stock revertido correctamente.`
    obtenerHistorial()
    obtenerProductos()

    setTimeout(() => { mensajeExito.value = '' }, 4000)
  } catch (err) {
    console.error(err)
    alert('❌ Error al anular la compra.')
  } finally {
    cargandoHistorial.value = false
  }
}

// --- IMPRIMIR / DESCARGAR REPORTE PDF ---
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
  <div class="flex min-h-screen bg-gray-900 text-gray-100 relative">
    
    <!-- BARRA LATERAL (Oculta al imprimir) -->
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
          <router-link to="/ventas" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
            <span>🛒</span>
            <span>Ventas</span>
          </router-link>
          <router-link to="/compras" class="flex items-center space-x-3 p-3 rounded-lg bg-yellow-500 text-gray-900 font-semibold shadow">
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
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h2 class="text-2xl md:text-3xl font-extrabold text-white">Módulo de Compras</h2>
          <p class="text-gray-400 mt-1 text-sm md:text-base">Registra el ingreso de mercadería y abastece tu stock.</p>
        </div>

        <!-- Pestañas -->
        <div class="flex bg-gray-800 p-1 rounded-xl border border-gray-700">
          <button 
            @click="cambiarVista('nueva')"
            :class="vistaActiva === 'nueva' ? 'bg-yellow-500 text-gray-900 font-bold' : 'text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm transition flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Ingresar Mercadería</span>
          </button>
          <button 
            @click="cambiarVista('historial')"
            :class="vistaActiva === 'historial' ? 'bg-yellow-500 text-gray-900 font-bold' : 'text-gray-400 hover:text-white'"
            class="px-4 py-2 rounded-lg text-sm transition flex items-center space-x-2"
          >
            <span>📜</span>
            <span>Historial de Compras</span>
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

      <!-- VISTA 1: NUEVA COMPRA -->
      <div v-if="vistaActiva === 'nueva'" class="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        
        <div class="lg:col-span-2 space-y-6">
          <!-- BUSCADOR DE PRODUCTOS Y BOTÓN CREAR -->
          <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg relative">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm font-medium text-gray-400">Buscar producto para reabastecer</label>
              <!-- BOTÓN CREAR PRODUCTO NUEVO -->
              <button 
                @click="mostrarModalNuevo = true"
                class="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/40 px-3 py-1.5 rounded-lg transition font-semibold flex items-center space-x-1"
              >
                <span>➕</span>
                <span>Crear Producto Nuevo</span>
              </button>
            </div>

            <div class="relative">
              <input 
                v-model="busqueda"
                type="text" 
                placeholder="Escribe el nombre o código..." 
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
                  <p class="text-xs text-gray-400 font-mono">Stock actual: {{ p.stock_actual }}</p>
                </div>
                <span class="text-xs bg-yellow-500/10 text-yellow-400 px-2.5 py-1 rounded border border-yellow-500/20 font-semibold">+ Seleccionar</span>
              </div>
            </div>
          </div>

          <!-- TABLA DE INGRESOS -->
          <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5">
            <h3 class="text-lg font-bold text-white mb-4">Lista de Entrada de Mercadería</h3>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm text-gray-300">
                <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-700">
                  <tr>
                    <th class="py-3 px-3">Producto</th>
                    <th class="py-3 px-3 text-center">Stock Actual</th>
                    <th class="py-3 px-3 text-center">Cantidad Ingreso</th>
                    <th class="py-3 px-3">Costo Unitario ($)</th>
                    <th class="py-3 px-3">Subtotal</th>
                    <th class="py-3 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-700/60">
                  <tr v-for="item in carritoCompra" :key="item.id" class="hover:bg-gray-700/30">
                    <td class="py-3 px-3 font-semibold text-white">{{ item.nombre }}</td>
                    <td class="py-3 px-3 text-center text-gray-400 font-mono">{{ item.stockActual }}</td>
                    <td class="py-3 px-3 text-center">
                      <input 
                        v-model.number="item.cantidad"
                        type="number" 
                        min="1"
                        class="w-20 bg-gray-900 border border-gray-700 text-white text-center rounded px-2 py-1 focus:outline-none focus:border-yellow-500"
                      />
                    </td>
                    <td class="py-3 px-3">
                      <input 
                        v-model.number="item.precioCosto"
                        type="number" 
                        step="0.01"
                        min="0"
                        class="w-24 bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 focus:outline-none focus:border-yellow-500"
                      />
                    </td>
                    <td class="py-3 px-3 font-bold text-emerald-400">
                      {{ formatearMoneda(item.cantidad * item.precioCosto) }}
                    </td>
                    <td class="py-3 px-3 text-center">
                      <button @click="removerItem(item.id)" class="text-red-400 hover:text-red-300 text-xs bg-red-500/10 px-2 py-1 rounded">Quitar</button>
                    </td>
                  </tr>
                  <tr v-if="carritoCompra.length === 0">
                    <td colspan="6" class="text-center py-8 text-gray-500">
                      Selecciona productos arriba o crea uno nuevo para registrar el ingreso.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- RESUMEN DE LA COMPRA -->
        <div>
          <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6 space-y-6">
            <h3 class="text-lg font-bold text-white pb-2 border-b border-gray-700">Datos del Proveedor</h3>

            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Nombre del Proveedor (Opcional)</label>
              <input 
                v-model="proveedor"
                type="text" 
                placeholder="Ej. Distribuidora Ferretera S.A." 
                class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div class="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-2">
              <div class="flex justify-between text-sm text-gray-400">
                <span>Items a Ingresar:</span>
                <span class="text-white font-bold">{{ carritoCompra.length }}</span>
              </div>
              <div class="flex justify-between text-lg font-extrabold text-white pt-2 border-t border-gray-800">
                <span>Inversión Total:</span>
                <span class="text-yellow-400">{{ formatearMoneda(totalCompra) }}</span>
              </div>
            </div>

            <button 
              @click="procesarCompra"
              :disabled="carritoCompra.length === 0 || cargando"
              class="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-4 rounded-xl transition shadow-lg"
            >
              {{ cargando ? 'Guardando...' : 'Confirmar e Incrementar Stock 🚚' }}
            </button>
          </div>
        </div>

      </div>

      <!-- VISTA 2: HISTORIAL DE COMPRAS CON PAGINACIÓN Y PDF COMPLETO -->
      <div v-if="vistaActiva === 'historial'" class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
          <div>
            <h3 class="text-lg font-bold text-white">Registro de Ingresos de Mercadería</h3>
            <p class="text-xs text-gray-400 mt-0.5">Mostrando compras filtradas por la fecha seleccionada.</p>
          </div>

          <div class="flex items-center space-x-3 w-full md:w-auto">
            <div class="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5">
              <span class="text-xs text-gray-400">📅 Fecha:</span>
              <input 
                v-model="fechaFiltro" 
                type="date" 
                class="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <button 
              @click="imprimirReporteDia" 
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 shadow"
            >
              <span>📥</span>
              <span>Guardar PDF / Imprimir</span>
            </button>
          </div>
        </div>

        <div class="hidden print:block mb-6 text-center border-b border-gray-300 pb-4">
          <h1 class="text-2xl font-bold text-black">Ferretería Don Villa</h1>
          <p class="text-sm text-gray-600">Reporte de Compras e Ingresos - Fecha: {{ fechaFiltro }}</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300 print:text-black">
            <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-700 print:bg-gray-100 print:text-black">
              <tr>
                <th class="py-3 px-4"># Compra / Fecha</th>
                <th class="py-3 px-4">Proveedor</th>
                <th class="py-3 px-4">Productos e Ingresos (Cant. y Costo)</th>
                <th class="py-3 px-4">Total Inversión</th>
                <th class="py-3 px-4 text-center print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700/60 print:divide-gray-300">
              <tr v-if="cargandoHistorial">
                <td colspan="5" class="text-center py-8 text-yellow-400 print:text-black">Cargando historial de compras... ⏳</td>
              </tr>

              <!-- FILAS EN PANTALLA: Usa 'historialPaginado' (máximo 10 por página) -->
              <tr v-for="c in historialPaginado" :key="c.id" class="hover:bg-gray-700/30 align-top print:hidden">
                <td class="py-4 px-4">
                  <span class="font-mono font-bold text-yellow-400">#{{ c.id }}</span>
                  <div class="text-xs text-gray-400 mt-1">{{ formatearFecha(c.fecha_transaccion) }}</div>
                </td>
                <td class="py-4 px-4 font-semibold text-white">{{ c.proveedor || 'Proveedor General' }}</td>
                <td class="py-4 px-4">
                  <div class="space-y-1">
                    <div v-for="(item, idx) in c.items" :key="idx" class="text-xs bg-gray-900/80 p-2 rounded border border-gray-700/50 flex justify-between items-center">
                      <span class="font-medium text-white">📦 {{ item.nombre_producto || 'Producto' }}</span>
                      <div class="space-x-3 text-right">
                        <span class="text-yellow-400 font-bold">Cant: {{ item.cantidad }}</span>
                        <span class="text-emerald-400">{{ formatearMoneda(item.subtotal) }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-4 px-4 font-bold text-emerald-400 text-base">{{ formatearMoneda(c.total) }}</td>
                <td class="py-4 px-4 text-center">
                  <button 
                    @click="anularCompra(c.id)" 
                    class="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg transition font-medium"
                  >
                    🗑️ Anular
                  </button>
                </td>
              </tr>

              <!-- FILAS EXCLUSIVAS PARA IMPRESIÓN PDF: Muestra 'historialFiltradoPorFecha' COMPLETO sin paginación -->
              <template v-for="c in historialFiltradoPorFecha" :key="'print-'+c.id">
                <tr class="hidden print:table-row align-top">
                  <td class="py-3 px-4">
                    <span class="font-mono font-bold text-black">#{{ c.id }}</span>
                    <div class="text-xs text-gray-600 mt-1">{{ formatearFecha(c.fecha_transaccion) }}</div>
                  </td>
                  <td class="py-3 px-4 font-semibold text-black">{{ c.proveedor || 'Proveedor General' }}</td>
                  <td class="py-3 px-4">
                    <div class="space-y-1">
                      <div v-for="(item, idx) in c.items" :key="idx" class="text-xs bg-gray-50 p-1.5 rounded border border-gray-300 flex justify-between items-center">
                        <span class="font-medium text-black">📦 {{ item.nombre_producto || 'Producto' }}</span>
                        <div class="space-x-3 text-right">
                          <span class="text-black font-bold">Cant: {{ item.cantidad }}</span>
                          <span class="text-black">{{ formatearMoneda(item.subtotal) }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4 font-bold text-black text-base">{{ formatearMoneda(c.total) }}</td>
                </tr>
              </template>

              <tr v-if="!cargandoHistorial && historialFiltradoPorFecha.length === 0">
                <td colspan="5" class="text-center py-8 text-gray-500">
                  No hay registros de compra para la fecha seleccionada ({{ fechaFiltro }}).
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

    <!-- MODAL REGISTRO DE NUEVO PRODUCTO -->
    <div v-if="mostrarModalNuevo" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        
        <div class="flex justify-between items-center border-b border-gray-700 pb-3">
          <h3 class="text-lg font-bold text-white flex items-center space-x-2">
            <span>📦</span>
            <span>Crear Producto Nuevo</span>
          </h3>
          <button @click="mostrarModalNuevo = false" class="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div class="space-y-3">
          <!-- NOMBRE -->
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1">Nombre del Producto *</label>
            <input 
              v-model="nuevoProducto.nombre"
              type="text" 
              placeholder="Ej. Martillo de Uña 16oz" 
              class="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500"
            />
          </div>

          <!-- CÓDIGO BARRAS (OPCIONAL) Y CATEGORÍA -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">Cód. Barras (Opcional)</label>
              <input 
                v-model="nuevoProducto.codigo"
                type="text" 
                placeholder="Autogenerado (PROD-XXXX)" 
                class="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">Categoría</label>
              <input 
                v-model="nuevoProducto.categoria"
                type="text" 
                placeholder="General" 
                class="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <!-- PRECIOS -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">Precio Costo ($)</label>
              <input 
                v-model.number="nuevoProducto.precio_costo"
                type="number" 
                step="0.01" 
                min="0"
                class="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">PVP Venta ($)</label>
              <input 
                v-model.number="nuevoProducto.pvp"
                type="number" 
                step="0.01" 
                min="0"
                class="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-3 border-t border-gray-700">
          <button 
            @click="mostrarModalNuevo = false"
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-semibold transition"
          >
            Cancelar
          </button>
          <button 
            @click="crearNuevoProducto"
            :disabled="cargandoNuevoProd"
            class="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold rounded-lg text-xs transition shadow"
          >
            {{ cargandoNuevoProd ? 'Guardando...' : 'Guardar y Añadir a Compra ➕' }}
          </button>
        </div>

      </div>
    </div>

  </div>
</template>