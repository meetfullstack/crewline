import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { SocketAdapter } from './realtime/socket.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useWebSocketAdapter(
    new SocketAdapter(app, config.get('WEB_ORIGIN', { infer: true })),
  );
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle('Crewline API')
    .setDescription('Workforce management and scheduling for restaurants.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('cl_access')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, openApi),
  );

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
