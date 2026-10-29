<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const nombreNegocio = ref('Ferretería Don Villa')
const porcentajeIva = ref(15.00)
const moneda = ref('$')
const stockMinimoGlobal = ref(5)

const cargando = ref(false)
const mensajeExito = ref('')
const errorMsg = ref('')

// --- GESTIÓN DE USUARIOS ---
const usuarios = ref([])
const nuevoUsuario = ref({
  nombre: '',
  email: '',
  password: '',
  rol: 'admin'
})
const cargandoUsuarios = ref(false)
const errorUsuarios = ref('')
const exitoUsuarios = ref('')

// --- CARGAR CONFIGURACIÓN ACTUAL ---
const obtenerConfiguracion = async () => {
  try {
    cargando.value = true
    const res = await fetch('http://localhost:3000/api/configuracion')
    if (!res.ok) throw new Error('Error al cargar la configuración')
    
    const data = await res.json()
    const config = Array.isArray(data) ? data[0] : data

    if (config) {
      nombreNegocio.value = config.nombre_negocio || 'Ferretería Don Villa'
      porcentajeIva.value = parseFloat(config.porcentaje_iva ?? 15.00)
      moneda.value = config.moneda || '$'
      stockMinimoGlobal.value = parseFloat(config.stock_minimo_global ?? 5)
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'No se pudo conectar con el servidor para cargar la configuración.'
  } finally {
    cargando.value = false
  }
}

// --- OBTENER USUARIOS ---
const obtenerUsuarios = async () => {
  try {
    cargandoUsuarios.value = true
    const res = await fetch('http://localhost:3000/api/usuarios')
    if (!res.ok) throw new Error('Error al obtener usuarios')
    usuarios.value = await res.json()
  } catch (err) {
    console.error(err)
    errorUsuarios.value = 'No se pudieron cargar los usuarios.'
  } finally {
    cargandoUsuarios.value = false
  }
}

onMounted(() => {
  obtenerConfiguracion()
  obtenerUsuarios()
})

// --- GUARDAR / ACTUALIZAR CONFIGURACIÓN ---
const guardarConfiguracion = async () => {
  try {
    cargando.value = true
    errorMsg.value = ''
    mensajeExito.value = ''

    const payload = {
      nombre_negocio: nombreNegocio.value.trim() || 'Ferretería Don Villa',
      porcentaje_iva: parseFloat(porcentajeIva.value) || 0,
      moneda: moneda.value.trim() || '$',
      stock_minimo_global: parseFloat(stockMinimoGlobal.value) || 5
    }

    const res = await fetch('http://localhost:3000/api/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('Error al guardar la configuración')

    mensajeExito.value = '¡Configuración actualizada correctamente 🚀!'
    setTimeout(() => { mensajeExito.value = '' }, 4000)

  } catch (err) {
    console.error(err)
    errorMsg.value = 'Hubo un error al actualizar los parámetros en la base de datos.'
  } finally {
    cargando.value = false
  }
}

// --- CREAR USUARIO ---
const crearUsuario = async () => {
  try {
    errorUsuarios.value = ''
    exitoUsuarios.value = ''

    const res = await fetch('http://localhost:3000/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevoUsuario.value)
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.mensaje || 'Error al crear usuario')

    exitoUsuarios.value = '¡Usuario creado con éxito 🚀!'
    nuevoUsuario.value = { nombre: '', email: '', password: '', rol: 'admin' }
    obtenerUsuarios()

    setTimeout(() => { exitoUsuarios.value = '' }, 4000)
  } catch (err) {
    errorUsuarios.value = err.message
  }
}

// --- ELIMINAR USUARIO ---
const eliminarUsuario = async (id) => {
  if (!confirm('¿Estás seguro de eliminar este usuario?')) return

  try {
    const res = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Error al eliminar usuario')
    obtenerUsuarios()
  } catch (err) {
    alert('No se pudo eliminar el usuario')
  }
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
          <router-link to="/inventario" class="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 transition">
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
          <router-link to="/configuracion" class="flex items-center space-x-3 p-3 rounded-lg bg-yellow-500 text-gray-900 font-semibold shadow">
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
    <main class="flex-1 p-6 md:p-8 overflow-y-auto space-y-8">
      
      <div>
        <h2 class="text-2xl md:text-3xl font-extrabold text-white">Configuración del Sistema</h2>
        <p class="text-gray-400 mt-1 text-sm md:text-base">Ajusta los parámetros generales del negocio y administra los accesos.</p>
      </div>

      <!-- MENSAJES CONFIG -->
      <div v-if="errorMsg" class="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
        <span>⚠️ {{ errorMsg }}</span>
      </div>
      <div v-if="mensajeExito" class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-sm">
        <span>✅ {{ mensajeExito }}</span>
      </div>

      <!-- FORMULARIO DE CONFIGURACIÓN GENERAL -->
      <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6 max-w-4xl space-y-6">
        <h3 class="text-lg font-bold text-yellow-400 border-b border-gray-700 pb-3">Parámetros Generales</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Nombre del Negocio</label>
            <input 
              v-model="nombreNegocio"
              type="text" 
              class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Porcentaje de IVA (%)</label>
              <input 
                v-model.number="porcentajeIva"
                type="number" 
                step="0.01"
                min="0"
                class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-300 mb-1">Símbolo de Moneda</label>
              <input 
                v-model="moneda"
                type="text" 
                class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-300 mb-1">Stock Mínimo Global de Alerta</label>
            <input 
              v-model.number="stockMinimoGlobal"
              type="number" 
              min="0"
              class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        <div class="pt-4 border-t border-gray-700 flex justify-end">
          <button 
            @click="guardarConfiguracion"
            :disabled="cargando"
            class="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-gray-900 font-bold px-6 py-2.5 rounded-xl transition shadow-lg text-sm"
          >
            {{ cargando ? 'Guardando...' : 'Guardar Cambios 💾' }}
          </button>
        </div>
      </div>

      <!-- SECCIÓN: GESTIÓN DE USUARIOS -->
      <div class="bg-gray-800 rounded-xl border border-gray-700 shadow-lg p-6 max-w-4xl space-y-6">
        <h3 class="text-lg font-bold text-yellow-400 border-b border-gray-700 pb-3">Gestión de Usuarios y Accesos</h3>

        <!-- MENSAJES USUARIOS -->
        <div v-if="errorUsuarios" class="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm">
          <span>⚠️ {{ errorUsuarios }}</span>
        </div>
        <div v-if="exitoUsuarios" class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-sm">
          <span>✅ {{ exitoUsuarios }}</span>
        </div>

        <!-- FORMULARIO NUEVO USUARIO -->
        <form @submit.prevent="crearUsuario" class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1">Nombre</label>
            <input v-model="nuevoUsuario.nombre" type="text" required placeholder="Ej. Juan Pérez" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1">Correo Electrónico</label>
            <input v-model="nuevoUsuario.email" type="email" required placeholder="correo@ferreteria.com" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1">Contraseña</label>
            <input v-model="nuevoUsuario.password" type="password" required placeholder="••••••••" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500" />
          </div>
          <div class="flex items-end gap-2">
            <div class="flex-1">
              <label class="block text-xs font-semibold text-gray-400 mb-1">Rol</label>
              <select v-model="nuevoUsuario.rol" class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500">
                <option value="admin">Admin</option>
                
              </select>
            </div>
            <button type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition h-[38px]">
              Crear ➕
            </button>
          </div>
        </form>

        <!-- TABLA DE USUARIOS -->
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-gray-300">
            <thead class="bg-gray-900 text-gray-400 uppercase text-xs">
              <tr>
                <th class="p-3">Nombre</th>
                <th class="p-3">Email</th>
                <th class="p-3">Rol</th>
                <th class="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              <tr v-for="u in usuarios" :key="u.id" class="hover:bg-gray-700/50">
                <td class="p-3 font-medium text-white">{{ u.nombre }}</td>
                <td class="p-3">{{ u.email }}</td>
                <td class="p-3">
                  <span class="px-2 py-1 rounded-full text-xs font-semibold" :class="u.rol === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'">
                    {{ u.rol }}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <button @click="eliminarUsuario(u.id)" class="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 p-1.5 rounded-lg transition text-xs">
                    🗑️ Eliminar
                  </button>
                </td>
              </tr>
              <tr v-if="usuarios.length === 0">
                <td colspan="4" class="p-4 text-center text-gray-500">No hay usuarios registrados.</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </main>
  </div>
</template>