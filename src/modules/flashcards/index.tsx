import type { PortalModule } from '../../core/modules';
import { BrowsePage } from './BrowsePage';
import { CardEditor } from './CardEditor';
import { CardsPage } from './CardsPage';
import { DecksPage } from './DecksPage';
import { ReviewPage, StudyAheadPage } from './ReviewPage';
import { StudyHome } from './StudyHome';
import { TemplatesPage } from './TemplatesPage';

export const flashcardsModule: PortalModule = {
  id: 'flashcards',
  nav: [
    { label: 'Study', path: '/', icon: 'study', order: 10 },
    { label: 'Add', path: '/add', icon: 'plus', order: 20 },
    { label: 'Cards', path: '/cards', icon: 'cards', order: 30 },
  ],
  routes: [
    { path: '/', title: 'Study', component: StudyHome },
    { path: '/review', title: 'Review', component: ReviewPage },
    { path: '/review/:deckId', title: 'Review', component: ReviewPage },
    { path: '/review/tag/:tag', title: 'Review', component: ReviewPage },
    { path: '/study-ahead', title: 'Study ahead', component: StudyAheadPage },
    { path: '/study-ahead/:deckId', title: 'Study ahead', component: StudyAheadPage },
    { path: '/study-ahead/tag/:tag', title: 'Study ahead', component: StudyAheadPage },
    { path: '/browse', title: 'Flip through', component: BrowsePage },
    { path: '/browse/:deckId', title: 'Flip through', component: BrowsePage },
    { path: '/browse/tag/:tag', title: 'Flip through', component: BrowsePage },
    { path: '/add', title: 'Add card', component: CardEditor },
    { path: '/add/deck/:deckId', title: 'Add card', component: CardEditor },
    { path: '/cards', title: 'Cards', component: CardsPage },
    { path: '/cards/deck/:deckId', title: 'Cards', component: CardsPage },
    { path: '/cards/:id', title: 'Edit card', component: CardEditor },
    { path: '/decks', title: 'Decks', component: DecksPage },
    { path: '/templates', title: 'Card types', component: TemplatesPage },
  ],
};
