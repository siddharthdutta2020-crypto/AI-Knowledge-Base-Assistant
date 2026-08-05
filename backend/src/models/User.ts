import { Schema, model, Document as MongooseDocument } from "mongoose";

export interface IUser extends MongooseDocument {
  email: string;
  password: string; // hashed
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

export default model<IUser>("User", userSchema);
