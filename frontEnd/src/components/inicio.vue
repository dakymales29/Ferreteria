<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// --- ESTADOS ---
const productos = ref([])
const stockMinimoGlobal = ref(1) // 👈 Valor por defecto, se actualiza con la BD
const cargando = ref(true)
const errorMsg = ref('')

const busqueda = ref('')
const categoriaSeleccionada = ref('')
const filtroEstado = ref('todos') // 'todos' | 'ok' | 'bajo'
const paginaActual = ref(1)
const productosPorPagina = 10

// --- CONEXIÓN AL BACKEND CON FETCH ---
const obtenerDatos = async () => {
  try {
    cargando.value = true
    errorMsg.value = ''
    
    // 1. Obtener Configuración Global desde el Backend
    try {
      const resConfig = await fetch('https://ferreteria-back-end.onrender.com/api/configuracion')
      if (resConfig.ok) {
        const dataConfig = await resConfig.json()
        if (dataConfig.stock_minimo_global !== undefined) {
          stockMinimoGlobal.value = parseInt(dataConfig.stock_minimo_global)
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración global:', e)
    }

    // 2. Obtener Productos
    const res = await fetch('https://ferreteria-back-end.onrender.com/api/productos')
    if (!res.ok) throw new Error('No se pudo obtener la información del servidor')
    
    const data = await res.json()
    productos.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('Error al conectar con la API:', err)
    errorMsg.value = 'Aviso: No se pudo conectar con el backend (asegúrate de que Node.js esté encendido).'
    productos.value = []
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  obtenerDatos()
})

// --- FORMATO DE MONEDA LIMPIO (Ej: $24,175.64) ---
const formatearMoneda = (valor) => {
  const numero = parseFloat(valor || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero)
}

// --- LISTA ÚNICA DE CATEGORÍAS PARA EL FILTRO ---
const categoriasDisponibles = computed(() => {
  const cats = productos.value.map(p => p.categoria).filter(Boolean)
  return [...new Set(cats)].sort()
})

// --- MÉTRICAS ---
const valorTotalInventario = computed(() => {
  return productos.value.reduce((total, p) => {
    const precio = parseFloat(p.pvp || 0)
    const stock = parseInt(p.stock_actual || 0)
    return total + (precio * stock)
  }, 0)
})

const totalProductos = computed(() => productos.value.length)

const productosStockBajoCount = computed(() => {
  return productos.value.filter(p => {
    const stock = parseInt(p.stock_actual || 0)
    const minimo = parseInt(stockMinimoGlobal.value) // 👈 Forzamos el uso del global
    return stock <= minimo
  }).length
})

// --- FILTRADO SEGURO Y BLINDADO ---
const productosFiltrados = computed(() => {
  const query = busqueda.value.toLowerCase().trim()

  return productos.value.filter(p => {
    const nombre = p.nombre ? String(p.nombre).toLowerCase().trim() : ''
    const codigo = p.codigo || p.id ? String(p.codigo || p.id).toLowerCase().trim() : ''
    const categoria = p.categoria ? String(p.categoria).trim() : ''
    
    const stock = parseInt(p.stock_actual || 0)
    const minimo = parseInt(stockMinimoGlobal.value) // 👈 Forzamos el uso del global
    const esStockBajo = stock <= minimo

    const coincideTexto = !query || nombre.includes(query) || codigo.includes(query)
    const coincideCategoria = !categoriaSeleccionada.value || categoria === categoriaSeleccionada.value
    
    let coincideEstado = true
    if (filtroEstado.value === 'ok') {
      coincideEstado = !esStockBajo
    } else if (filtroEstado.value === 'bajo') {
      coincideEstado = esStockBajo
    }

    return coincideTexto && coincideCategoria && coincideEstado
  })
})

// --- PAGINACIÓN ---
const totalPaginas = computed(() => {
  return Math.ceil(productosFiltrados.value.length / productosPorPagina) || 1
})

const productosPaginados = computed(() => {
  const inicio = (paginaActual.value - 1) * productosPorPagina
  return productosFiltrados.value.slice(inicio, inicio + productosPorPagina)
})

const cambiarPagina = (nueva) => {
  if (nueva >= 1 && nueva <= totalPaginas.value) {
    paginaActual.value = nueva
  }
}

const cambiarFiltroEstado = (estado) => {
  filtroEstado.value = estado
  paginaActual.value = 1
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
    <aside class="w-64 bg-gray-800 p-6 flex flex-col justify-between border-r border-gray-700 shrink-0">
      <div>
        <div class="flex items-center space-x-3 mb-8">
          <span class="text-3xl">🛠️</span>
          <h1 class="text-xl font-bold text-yellow-400">Don Villa</h1>
        </div>

        <nav class="space-y-3">
          <router-link to="/inventario" class="flex items-center space-x-3 p-3 rounded-lg bg-yellow-500 text-gray-900 font-semibold shadow">
            <span>📦</span>
            <span>Inventario</span>
          </router-link>
          <router-link to="/ventas" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
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
      
      <!-- ENCABEZADO -->
      <header class="mb-6">
        <h2 class="text-2xl md:text-3xl font-extrabold text-white">Vista General del Inventario</h2>
        <p class="text-gray-400 mt-1 text-sm md:text-base">Control de stock, alertas y métricas en tiempo real.</p>
      </header>

      <!-- MENSAJE DE ERROR -->
      <div v-if="errorMsg" class="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-xl mb-6 text-sm flex items-center justify-between">
        <span>⚠️ {{ errorMsg }}</span>
        <button @click="obtenerDatos" class="underline font-semibold hover:text-amber-300 ml-2">Reintentar</button>
      </div>

      <!-- TARJETAS DE MÉTRICAS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs md:text-sm font-medium text-gray-400">Valor Total en Stock (PVP)</p>
              <p class="text-2xl md:text-3xl font-bold text-emerald-400 mt-1">{{ formatearMoneda(valorTotalInventario) }}</p>
            </div>
            <div class="text-2xl md:text-3xl p-3 bg-emerald-500/10 rounded-lg text-emerald-400">💰</div>
          </div>
        </div>

        <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs md:text-sm font-medium text-gray-400">Total de Ítems</p>
              <p class="text-2xl md:text-3xl font-bold text-blue-400 mt-1">{{ totalProductos }}</p>
            </div>
            <div class="text-2xl md:text-3xl p-3 bg-blue-500/10 rounded-lg text-blue-400">🏷️</div>
          </div>
        </div>

        <div class="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg sm:col-span-2 lg:col-span-1">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs md:text-sm font-medium text-gray-400">Alertas de Stock Bajo</p>
              <p class="text-2xl md:text-3xl font-bold text-red-400 mt-1">{{ productosStockBajoCount }}</p>
            </div>
            <div class="text-2xl md:text-3xl p-3 bg-red-500/10 rounded-lg text-red-400">⚠️</div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN TABLA Y FILTROS -->
      <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-5 md:p-6">
        
        <!-- FILTROS -->
        <div class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 mb-6">
          <!-- Búsqueda -->
          <div class="relative w-full lg:w-72">
            <input 
              v-model="busqueda"
              type="text" 
              placeholder="Buscar por nombre o código..." 
              class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-yellow-500 transition placeholder-gray-500"
            />
            <span class="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          </div>

          <!-- Filtro de Categorías -->
          <div class="w-full lg:w-48">
            <select 
              v-model="categoriaSeleccionada"
              class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition"
            >
              <option value="">Todas las categorías</option>
              <option v-for="cat in categoriasDisponibles" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <!-- BOTONES DE FILTRO RÁPIDO -->
          <div class="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button 
              @click="cambiarFiltroEstado('todos')"
              :class="filtroEstado === 'todos' ? 'bg-gray-700 text-white border-gray-500' : 'bg-gray-900 text-gray-400 border-gray-700'"
              class="px-3 py-2 rounded-lg border text-xs font-semibold transition shrink-0"
            >
              Todos
            </button>
            <button 
              @click="cambiarFiltroEstado('ok')"
              :class="filtroEstado === 'ok' ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'"
              class="px-3 py-2 rounded-lg border text-xs font-semibold transition shrink-0"
            >
              🟢 Stock OK
            </button>
            <button 
              @click="cambiarFiltroEstado('bajo')"
              :class="filtroEstado === 'bajo' ? 'bg-red-600 text-white border-red-400 shadow-lg' : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'"
              class="px-3 py-2 rounded-lg border text-xs font-semibold transition shrink-0"
            >
              🔴 Stock Bajo
            </button>
          </div>
        </div>

        <!-- TABLA -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300 whitespace-nowrap">
            <thead class="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider border-b border-gray-700">
              <tr>
                <th class="py-3 px-3">Código</th>
                <th class="py-3 px-3">Producto</th>
                <th class="py-3 px-3">Categoría</th>
                <th class="py-3 px-3">Costo</th>
                <th class="py-3 px-3">PVP</th>
                <th class="py-3 px-3">Stock</th>
                <th class="py-3 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700/60">
              
              <!-- Estado de carga -->
              <tr v-if="cargando">
                <td colspan="7" class="text-center py-8 text-yellow-400 font-medium">
                  Cargando inventario... ⏳
                </td>
              </tr>

              <!-- Productos mapeados usando stockMinimoGlobal estricto -->
              <tr 
                v-for="p in productosPaginados" 
                :key="p.id"
                class="hover:bg-gray-700/40 transition"
              >
                <td class="py-3 px-3 font-mono text-yellow-400">{{ p.codigo || p.id }}</td>
                <td class="py-3 px-3 font-semibold text-white max-w-xs truncate">{{ p.nombre }}</td>
                <td class="py-3 px-3 text-gray-400">{{ p.categoria || 'General' }}</td>
                
                <td class="py-3 px-3 text-gray-400">{{ formatearMoneda(p.precio_costo) }}</td>
                <td class="py-3 px-3 font-medium text-emerald-400">{{ formatearMoneda(p.pvp) }}</td>
                
                <!-- Stock Actual comparado directo con stockMinimoGlobal -->
                <td class="py-3 px-3 font-bold" :class="parseInt(p.stock_actual || 0) <= parseInt(stockMinimoGlobal) ? 'text-red-400' : 'text-gray-200'">
                  {{ p.stock_actual ?? 0 }}
                </td>

                <td class="py-3 px-3 text-center">
                  <span 
                    v-if="parseInt(p.stock_actual || 0) <= parseInt(stockMinimoGlobal)" 
                    class="inline-block bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] px-2 py-0.5 rounded-full font-medium"
                  >
                    Stock Bajo
                  </span>
                  <span 
                    v-else 
                    class="inline-block bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] px-2 py-0.5 rounded-full font-medium"
                  >
                    OK
                  </span>
                </td>
              </tr>

              <tr v-if="!cargando && productosPaginados.length === 0">
                <td colspan="7" class="text-center py-8 text-gray-500">
                  No se encontraron productos registrados con esos filtros.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PAGINACIÓN -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-3 mt-5 pt-4 border-t border-gray-700 text-sm">
          <span class="text-gray-400 text-xs md:text-sm">
            Página <span class="font-bold text-white">{{ paginaActual }}</span> de <span class="font-bold text-white">{{ totalPaginas }}</span>
          </span>

          <div class="flex space-x-2">
            <button 
              @click="cambiarPagina(paginaActual - 1)" 
              :disabled="paginaActual === 1"
              class="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-xs md:text-sm transition"
            >
              Anterior
            </button>
            <button 
              @click="cambiarPagina(paginaActual + 1)" 
              :disabled="paginaActual >= totalPaginas"
              class="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-xs md:text-sm transition"
            >
              Siguiente
            </button>
          </div>
        </div>

      </div>

    </main>
  </div>
</template>