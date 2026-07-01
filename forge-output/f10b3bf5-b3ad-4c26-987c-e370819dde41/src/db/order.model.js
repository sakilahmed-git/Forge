import mongoose, { Schema } from 'mongoose';
const orderSchema = new Schema({ products: [{ type: Schema.Types.ObjectId, ref: 'Product' }], total: { type: Number, required: true } });
export const OrderModel = mongoose.model('Order', orderSchema);