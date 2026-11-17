import type { PortalModule } from '../../core/modules';

/** The walkthrough video, served from public/media/ (not cached for offline use). */
const VIDEO = 'media/review-video.mp4';
const POSTER = 'media/review-video.jpg';

function TutorialPage() {
  return (
    <>
      <div class="page-head">
        <h1>How to use 水餃</h1>
      </div>
      <section class="panel stack">
        <p>
          A walkthrough of the whole portal: adding cards, getting the course cards, studying and flipping
          through, managing your cards and decks, settings, and backups.
        </p>
        <video class="tutorial-video" controls preload="metadata" playsInline poster={POSTER} src={VIDEO}>
          Your browser can't play this video.
        </video>
        <p class="small muted">The video needs an internet connection.</p>
      </section>
    </>
  );
}

export const tutorialModule: PortalModule = {
  id: 'tutorial',
  nav: [{ label: 'How to', path: '/how-to', icon: 'play', order: 45 }],
  routes: [{ path: '/how-to', title: 'How to', component: TutorialPage }],
};
