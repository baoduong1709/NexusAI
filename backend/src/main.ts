import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import * as express from "express";
import { join } from "path";
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  // Serve uploaded files
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));

  // Only expose Swagger docs in non-production environments
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("NexusAI API")
      .setDescription("AI-Powered Project & Resource Management System")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`NexusAI Backend is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
