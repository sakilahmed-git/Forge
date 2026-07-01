import { ProductModel } from './product.model.js';
import { OrderModel } from './order.model.js';
const mongoose = require('mongoose');
const dbUrl = process.env.DB_URL;
async function connectToDb() { try { await mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true }); console.log('Database connection established'); } catch (error) { console.error('Error connecting to database:', error); } }
export async function getProducts() { try { const products = await ProductModel.find(); return products; } catch (error) { console.error('Error retrieving products:', error); throw error; } }
export async function createOrder(orderData) { try { const order = new OrderModel(orderData); await order.save(); return order; } catch (error) { console.error('Error creating order:', error); throw error; } }
export async function updateProduct(productId, productData) { try { const product = await ProductModel.findByIdAndUpdate(productId, productData, { new: true }); return product; } catch (error) { console.error('Error updating product:', error); throw error; } }
export async function updateOrder(orderId, orderData) { try { const order = await OrderModel.findByIdAndUpdate(orderId, orderData, { new: true }); return order; } catch (error) { console.error('Error updating order:', error); throw error; } }
connectToDb();