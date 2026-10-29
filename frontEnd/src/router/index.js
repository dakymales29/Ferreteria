import { createRouter, createWebHistory } from 'vue-router'
import Inicio from '../components/inicio.vue'
import Ventas from '../components/Ventas.vue'
import Compras from '../components/Compras.vue'
import Configuracion from '../components/Configuracion.vue'
import Login from '../components/Login.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/inventario', name: 'Inventario', component: Inicio, meta: { requiresAuth: true } },
  { path: '/ventas', name: 'Ventas', component: Ventas, meta: { requiresAuth: true } },
  { path: '/compras', name: 'Compras', component: Compras, meta: { requiresAuth: true } },
  { path: '/configuracion', name: 'Configuracion', component: Configuracion, meta: { requiresAuth: true } },
  { path: '/login', name: 'Login', component: Login }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 🔐 GUARDIÁN DE NAVEGACIÓN (Bloquea rutas si no hay sesión)
router.beforeEach((to, from, next) => {
  const usuarioLogueado = localStorage.getItem('usuario_pos')

  // Si intenta entrar a una ruta protegida y NO está logueado
  if (to.meta.requiresAuth && !usuarioLogueado) {
    return next('/login')
  }

  // Si ya está logueado e intenta ir al login manualmente
  if (to.path === '/login' && usuarioLogueado) {
    return next('/inventario')
  }

  next()
})

export default router