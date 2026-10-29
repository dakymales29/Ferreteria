<template>
  <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
      
      <!-- Encabezado / Logo -->
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl mb-2 border border-blue-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white tracking-wide">Ferretería Don Villa</h1>
        <p class="text-slate-400 text-sm">Ingresa tus credenciales para acceder al sistema</p>
      </div>

      <!-- Alerta de Error -->
      <div v-if="errorMsg" class="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2">
        <span>⚠️</span>
        <span>{{ errorMsg }}</span>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Correo Electrónico</label>
          <input 
            v-model="form.email"
            type="email" 
            required
            placeholder="correo@gmail.com"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
          <input 
            v-model="form.password"
            type="password" 
            required
            placeholder="••••••••"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button 
          type="submit"
          :disabled="cargando"
          class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <span v-if="cargando" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
          <span>{{ cargando ? 'Iniciando sesión...' : 'Ingresar al Sistema' }}</span>
        </button>
      </form>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const form = reactive({
  email: '',
  password: ''
});

const cargando = ref(false);
const errorMsg = ref('');

const handleLogin = async () => {
  cargando.value = true;
  errorMsg.value = '';

  try {
    const res = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.mensaje || 'Error al iniciar sesión');
    }

    // 1. Guardar la sesión en el navegador
    localStorage.setItem('usuario_pos', JSON.stringify(data.usuario));

    // 2. Redirigir al dashboard / módulo principal
    router.push('/inventario'); // o la ruta principal que tengas

  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    cargando.value = false;
  }
};
</script>