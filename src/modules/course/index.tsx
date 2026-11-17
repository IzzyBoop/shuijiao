import type { PortalModule } from '../../core/modules';
import { CoursePage } from './CoursePage';

/** The course cards published with the site, for students to look through and import. */
export const courseModule: PortalModule = {
  id: 'course',
  // Reached from the Study page, not the navigation bar.
  nav: [],
  routes: [{ path: '/course', title: 'Course cards', component: CoursePage }],
};
