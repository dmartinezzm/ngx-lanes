import { Routes } from '@angular/router';
import { BuggyPage } from './buggy-page';
import { ProPage } from './pro-page';
import { TimelinePage } from './timeline-page';

export const routes: Routes = [
  { path: '', component: TimelinePage, title: 'Lanes demo · 1,000 resources, 10,000 bars' },
  { path: 'pro', component: ProPage, title: 'Lanes Pro · waitlist' },
  { path: 'errors', component: BuggyPage, title: 'Probe demo · page with bugs' },
  { path: '**', redirectTo: '' },
];
