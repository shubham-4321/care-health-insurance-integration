import { Express } from "express";
import PolicyController from "../controllers/controllers"

export = (app : Express) => {
  app.use(`/api/v1/policy`,PolicyController.router)
}