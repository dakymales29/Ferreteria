import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import productosRutas from './rutas/productos.routes.js'
import comprasRutas from './rutas/compras.routes.js'
import configuracionRutas from './rutas/configuracion.routes.js'
import usuariosRutas from './rutas/usuarios.routes.js'
import ventasRutas from './rutas/ventas.routes.js'




dotenv.config();//con esto cargamos las variables de nuestro .env
const app = express();

//middlewares
app.use(cors()); //le damos permiso a cualquier persona conectarse al backEnd
app.use(express.json()); //permite peticiones en formato json

//rutas
app.use('/api',productosRutas);
app.use('/api',comprasRutas);
app.use('/api',ventasRutas);
app.use('/api',configuracionRutas);
app.use('/api',usuariosRutas);



//RUTA DE prueba
app.get('/',(req,res)=>{
    res.json({mensaje:'BACK END FERRETERIA FUNCIONANDO 🚀'})
})

export default app