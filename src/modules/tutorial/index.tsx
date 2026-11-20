import { useRef } from 'preact/hooks';
import type { PortalModule } from '../../core/modules';
import { href } from '../../core/router';

/** The walkthrough video, served from public/media/ (not cached for offline use). */
const VIDEO = 'media/how-to-video.mp4';
const POSTER = 'media/how-to-video.jpg';

/** Where each part of the walkthrough starts, in seconds. */
const CHAPTERS: readonly [number, string][] = [
  [0, 'A quick look around'],
  [195, 'Adding a card'],
  [415, 'Getting the course cards'],
  [683, 'Flipping through cards'],
  [718, 'Adding a word while you study'],
  [843, 'Studying'],
  [908, 'Your progress'],
  [983, 'Finding and changing cards'],
  [1173, 'Resources'],
  [1198, 'How to'],
  [1218, 'Settings'],
  [1378, 'Card types'],
  [1425, 'Backups'],
  [1508, 'About'],
  [1538, '墨 Ink (beta)'],
  [1608, 'Reporting a problem'],
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function TutorialPage() {
  const video = useRef<HTMLVideoElement>(null);
  const jump = (seconds: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = seconds;
    v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    void v.play().catch(() => {
      // Autoplay refused: the video is at the right place, ready to play.
    });
  };

  return (
    <>
      <div class="page-head">
        <h1>How to use 水餃</h1>
      </div>

      <section class="panel stack">
        <h2>Quick start</h2>
        <ol class="stack-tight">
          <li>
            <strong>Add your words.</strong> Go to <a href={href('/add')}>Add</a>, type a word or sentence
            from class in Chinese, and press <em>Fill in details</em>. Check each field, then{' '}
            <em>Save card</em>.
          </li>
          <li>
            <strong>Or start from the course cards.</strong> On the <a href={href('/')}>Study</a> page, open{' '}
            <em>Course cards</em> and press <em>Import these cards</em>.
          </li>
          <li>
            <strong>Study a little every day.</strong> Press <em>Study now</em>. Try to remember the answer,
            press <span class="kbd">Space</span> to see it, then say how well you knew it: <em>Again</em>,{' '}
            <em>Hard</em>, <em>Good</em> or <em>Easy</em> (keys <span class="kbd">1</span>–
            <span class="kbd">4</span>). Cards you find hard come back sooner.
          </li>
          <li>
            <strong>Back up now and then.</strong> Your cards are stored only in this browser. In{' '}
            <a href={href('/settings')}>Settings</a>, press <em>Download backup</em>, and keep the file
            somewhere safe. Import it to move your cards to another device or browser.
          </li>
        </ol>
      </section>

      <section class="panel stack">
        <h2>Video walkthrough</h2>
        <p>
          The whole portal in 28 minutes: adding cards, getting the course cards, studying and flipping
          through, your progress, managing your cards, settings, backups, and the 墨 Ink style.
        </p>
        <video
          ref={video}
          class="tutorial-video"
          controls
          preload="metadata"
          playsInline
          poster={POSTER}
          src={VIDEO}
        >
          Your browser can't play this video.
        </video>
        <p class="small muted">The video needs an internet connection.</p>
        <h3>Jump to a part</h3>
        <ul class="chapters">
          {CHAPTERS.map(([seconds, title]) => (
            <li key={seconds}>
              <button
                type="button"
                class="ghost"
                onClick={() => {
                  jump(seconds);
                }}
              >
                <span class="chapter-time">{clock(seconds)}</span> {title}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export const tutorialModule: PortalModule = {
  id: 'tutorial',
  nav: [{ label: 'How to', path: '/how-to', icon: 'play', order: 45 }],
  routes: [{ path: '/how-to', title: 'How to', component: TutorialPage }],
};
