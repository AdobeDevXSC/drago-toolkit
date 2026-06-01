import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';
const HEADER_ACTIONS = [
  '/tools/widgets/scheme',
  '/tools/widgets/language',
  '/tools/widgets/toggle',
];

function isSideNavLayout() {
  return document.body.classList.contains('layout-side-nav');
}

function closeAllMenus() {
  const openMenus = document.body.querySelectorAll('header .is-open');
  for (const openMenu of openMenus) {
    openMenu.classList.remove('is-open');
  }
}

function closeSidenavDrawer() {
  document.body.classList.remove('sidenav-open');
  document.body.querySelector('header')?.classList.remove('is-mobile-open');
}

function docClose(e) {
  if (e.target.closest('header')) return;
  closeAllMenus();
  if (isSideNavLayout() && window.matchMedia('(width < 900px)').matches) {
    closeSidenavDrawer();
  }
}

function toggleMenu(menu) {
  const isOpen = menu.classList.contains('is-open');
  closeAllMenus();
  if (isOpen) {
    document.removeEventListener('click', docClose);
    return;
  }

  document.addEventListener('click', docClose);
  menu.classList.add('is-open');
}

function decorateLanguage(btn) {
  const section = btn.closest('.section');
  btn.addEventListener('click', async () => {
    let menu = section.querySelector('.language.menu');
    if (!menu) {
      const content = document.createElement('div');
      content.classList.add('block-content');
      const fragment = await loadFragment(`${locale.prefix}${HEADER_PATH}/languages`);
      menu = document.createElement('div');
      menu.className = 'language menu';
      menu.append(fragment);
      content.append(menu);
      section.append(content);
    }
    toggleMenu(section);
  });
}

function decorateScheme(btn) {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref = localStorage.getItem('color-scheme');
    if (!currPref) {
      currPref = matchMedia('(prefers-color-scheme: dark)')
        .matches ? 'dark-scheme' : 'light-scheme';
    }

    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    localStorage.setItem('color-scheme', theme.add);
    const sections = document.querySelectorAll('.section');
    for (const section of sections) {
      setColorScheme(section);
    }
  });
}

function decorateNavToggle(btn) {
  btn.addEventListener('click', () => {
    const header = document.body.querySelector('header');
    if (!header) return;
    const open = header.classList.toggle('is-mobile-open');
    document.body.classList.toggle('sidenav-open', open);
  });
}

function ensureSidenavScrim() {
  if (document.querySelector('.sidenav-scrim')) return;
  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'sidenav-scrim';
  scrim.setAttribute('aria-label', 'Close navigation');
  scrim.addEventListener('click', closeSidenavDrawer);
  document.body.append(scrim);
}

function bindSidenavEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !document.body.classList.contains('sidenav-open')) return;
    closeSidenavDrawer();
    closeAllMenus();
  });
}

function setActiveNavLink(root) {
  const { pathname } = window.location;
  root.querySelectorAll('a[href]').forEach((anchor) => {
    try {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const url = new URL(anchor.href, window.location.origin);
      if (url.pathname === pathname) {
        anchor.setAttribute('aria-current', 'page');
        anchor.closest('.main-nav-item')?.classList.add('is-current');
      }
    } catch {
      /* ignore malformed href */
    }
  });
}

async function decorateAction(header, pattern) {
  const link = header.querySelector(`[href*="${pattern}"]`);
  if (!link) return;

  const icon = link.querySelector('.icon');
  const text = link.textContent;
  const btn = document.createElement('button');
  if (icon) btn.append(icon);
  if (text) {
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = text;
    btn.append(textSpan);
  }
  const wrapper = document.createElement('div');
  const iconClass = icon?.classList?.[1]?.replace('icon-', '') || 'action';
  wrapper.className = `action-wrapper ${iconClass}`;
  wrapper.append(btn);
  link.parentElement.parentElement.replaceChild(wrapper, link.parentElement);

  if (pattern === '/tools/widgets/language') decorateLanguage(btn);
  if (pattern === '/tools/widgets/scheme') decorateScheme(btn);
  if (pattern === '/tools/widgets/toggle') decorateNavToggle(btn);
}

function decorateMenu() {
  return null;
}

function decorateMegaMenu(li) {
  const menu = li.querySelector('.fragment-content');
  if (!menu) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'mega-menu';
  wrapper.append(menu);
  li.append(wrapper);
  return wrapper;
}

function decorateNavItem(li) {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  if (link) link.classList.add('main-nav-link');
  const menu = decorateMegaMenu(li) || decorateMenu(li);
  if (!link && !menu) return;
  if (menu && link) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (isSideNavLayout()) {
        const open = li.classList.toggle('is-open');
        link.setAttribute('aria-expanded', open ? 'true' : 'false');
      } else {
        toggleMenu(li);
      }
    });
    if (isSideNavLayout()) link.setAttribute('aria-expanded', 'false');
  }
}

function decorateBrandSection(section) {
  section.classList.add('brand-section');
  const brandLink = section.querySelector('a');
  if (!brandLink) return;
  const [, text] = brandLink.childNodes;
  const span = document.createElement('span');
  span.className = 'brand-text';
  span.append(text);
  brandLink.append(span);
}

function decorateNavSection(section) {
  section.classList.add('main-nav-section');
  const navContent = section.querySelector('.default-content');
  const navList = section.querySelector('ul');
  if (!navList) return;
  navList.classList.add('main-nav-list');

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Primary');
  nav.append(navList);
  navContent.append(nav);

  const mainNavItems = section.querySelectorAll('nav > ul > li');
  for (const navItem of mainNavItems) {
    decorateNavItem(navItem);
  }
  if (isSideNavLayout()) setActiveNavLink(nav);
}

function decorateSecondarySection(section) {
  section.classList.add('sidenav-secondary');
}

async function decorateActionSection(section) {
  section.classList.add('actions-section');
}

async function decorateHeader(fragment) {
  const sections = fragment.querySelectorAll(':scope > .section');
  if (sections[0]) decorateBrandSection(sections[0]);
  if (sections[1]) decorateNavSection(sections[1]);
  if (sections[2]) decorateActionSection(sections[2]);
  if (sections[3]) decorateSecondarySection(sections[3]);

  for (const pattern of HEADER_ACTIONS) {
    decorateAction(fragment, pattern);
  }
}

/**
 * loads and decorates the header
 * @param {Element} el The header element
 */
export default async function init(el) {
  const headerMeta = getMetadata('header');
  const path = headerMeta || HEADER_PATH;
  try {
    if (isSideNavLayout()) {
      el.classList.add('site-sidenav');
      ensureSidenavScrim();
      bindSidenavEscape();
    }
    const fragment = await loadFragment(`${locale.prefix}${path}`);
    fragment.classList.add('header-content', 'sidenav-inner');
    await decorateHeader(fragment);
    el.append(fragment);
  } catch (e) {
    throw Error(e);
  }
}
