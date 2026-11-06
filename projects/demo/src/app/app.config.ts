import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { probeHttpInterceptor, provideProbe } from 'ngx-probe';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([probeHttpInterceptor])),
    // En una app real basta con provideProbe(): se activa solo en desarrollo.
    provideProbe({ enabled: true }),
  ],
};
