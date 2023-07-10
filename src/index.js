const express =require('express');
const app=express();
const a=require('./app');
app.use(a);
app.listen(process.env.PORT||8080,()=>console.log('Server is Running'))
