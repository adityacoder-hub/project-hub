import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, Command, Eye, FileQuestion, Filter, Heart, Layers3, LockKeyhole,
  Menu, Moon, Search, Settings2, ShieldCheck, Sparkles, Sun, X,
} from 'lucide-react';
import {
  getGetAccountQueryKey, getGetAdminOverviewQueryKey, getGetAuthSessionQueryKey, getGetProjectQueryKey,
  getGetSubscriptionQueryKey, getHealthCheckQueryKey, getListAdminProjectsQueryKey,
  getListDownloadsQueryKey, getListFavoritesQueryKey, getListNotificationsQueryKey,
  getListProjectsQueryKey, useArchiveProject, useCreateProject, useGetAccount,
  useGetAdminOverview, useGetAuthSession, useGetProject, useGetSubscription, useHealthCheck,
  useListAdminProjects, useListDownloads, useListFavorites, useListNotifications,
  useListProjects, useRecordProjectView, useRemoveFavorite, useRequestProjectDownload,
  useSaveFavorite, useSetProjectPublication, useSignIn, useSignOut, useSignUp, useUpdateProject,
} from '@workspace/api-client-react';
import type { Project, ProjectInput, ProjectUpdate } from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function ThemeControl() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('hub-theme');
    const initial = saved ? saved === 'dark' : false;
    setDark(initial);
    document.documentElement.classList.toggle('dark', initial);
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('hub-theme', next ? 'dark' : 'light');
  }
  return <button className="icon-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} onClick={toggle} data-testid="button-toggle-theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>;
}

function SearchBox({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    setLocation(`/search${value.trim() ? `?q=${encodeURIComponent(value.trim())}` : ''}`);
  }
  return <form className={`search-box ${compact ? 'search-compact' : ''}`} onSubmit={submit} role="search">
    <Search size={17} aria-hidden="true" />
    <input aria-label="Search projects" placeholder="Search the catalog" value={value} onChange={e => setValue(e.target.value)} data-testid={`input-project-search-${compact ? 'header' : 'page'}`} />
    <button type="submit" aria-label="Submit project search" data-testid={`button-search-${compact ? 'header' : 'page'}`}><ArrowRight size={16} /></button>
  </form>;
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn, isLoaded, user } = useAuthAccount();
  const signOut = useSignOut();
  const client = useQueryClient();
  const [location, setLocation] = useLocation();
  const links = [['Explore', '/projects'], ['Free', '/free'], ['Premium', '/premium'], ['About', '/about']] as const;
  function handleSignOut() {
    signOut.mutate(undefined, {
      onSuccess: () => {
        client.clear();
        setLocation('/');
      },
    });
  }
  return <header className="site-header">
    <div className="header-inner">
      <Link href="/" className="brand" aria-label="Project Hub home" data-testid="link-brand-home">
        <span className="brand-mark"><img src={`${basePath}/logo.svg`} alt="" /></span>
        <span>Project<span className="brand-light">Hub</span><small>OWNER-CURATED SOFTWARE</small></span>
      </Link>
      <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} className={location === href ? 'nav-link active' : 'nav-link'} data-testid={`link-nav-${label.toLowerCase()}`} onClick={() => setMenuOpen(false)}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        <div className="header-search"><SearchBox compact /></div>
        <ThemeControl />
        {isSignedIn ? <div className="user-menu">
          <Link href="/account" className="avatar-chip" title="Your account" data-testid="link-account-avatar">{user?.displayName?.[0] || user?.email?.[0] || 'A'}</Link>
          <button onClick={handleSignOut} disabled={signOut.isPending} className="text-button signout-button" data-testid="button-sign-out">{signOut.isPending ? 'Signing out…' : 'Sign out'}</button>
        </div> : isLoaded ? <Link href="/sign-in" className="button button-dark header-signin" data-testid="link-sign-in">Sign in</Link> : <span className="auth-header-loading" aria-label="Checking sign-in status" />}
        <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} data-testid="button-mobile-menu">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
    </div>
  </header>;
}

function Footer() {
  return <footer className="site-footer">
    <div className="footer-main">
      <div><Link href="/" className="brand footer-brand"><span className="brand-mark"><img src={`${basePath}/logo.svg`} alt="" /></span><span>Project<span className="brand-light">Hub</span><small>TOOLS MADE WITH PURPOSE</small></span></Link><p>A considered collection of original software, made and maintained by one independent creator.</p></div>
      <div className="footer-links"><span className="eyebrow">Explore</span><Link href="/projects">All projects</Link><Link href="/free">Free releases</Link><Link href="/premium">Premium releases</Link><Link href="/about">About the catalog</Link></div>
      <div className="footer-links"><span className="eyebrow">Information</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link><Link href="/disclaimer">Disclaimer</Link></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Project Hub</span><span>Independent software. Owner curated.</span><Link href="/admin/login" className="admin-footer">Owner access</Link></div>
  </footer>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="site-shell noise"><Header /><main className="page-enter">{children}</main><Footer /></div>;
}

function PageHeading({ kicker, title, copy, aside }: { kicker?: string; title: ReactNode; copy?: string; aside?: ReactNode }) {
  return <div className="page-heading"><div>{kicker && <div className="eyebrow">{kicker}</div>}<h1>{title}</h1>{copy && <p>{copy}</p>}</div>{aside && <div className="page-heading-aside">{aside}</div>}</div>;
}

function LoadingGrid() {
  return <div className="project-grid" aria-label="Loading projects">{[0, 1, 2, 3].map(i => <div className="project-card skeleton-card" key={i}><div className="skeleton skeleton-art" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-line" /></div>)}</div>;
}

function ErrorState({ onRetry, message = 'The catalog could not be reached right now.' }: { onRetry?: () => void; message?: string }) {
  return <div className="state-panel error-state"><span className="state-icon"><CircleHelp /></span><h2>Something interrupted the connection</h2><p>{message}</p>{onRetry && <button className="button button-outline" onClick={onRetry} data-testid="button-retry">Try again</button>}</div>;
}

function EmptyState({ title = 'Nothing here yet', copy = 'When something is available, it will show up here.' }: { title?: string; copy?: string }) {
  return <div className="state-panel"><span className="state-icon"><Layers3 /></span><h2>{title}</h2><p>{copy}</p><Link href="/projects" className="button button-outline">Browse projects <ArrowRight size={15} /></Link></div>;
}

function formatDate(value?: string | Date) {
  if (!value) return 'Date unavailable';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Date unavailable' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function Artwork({ project, className = '' }: { project: Project; className?: string }) {
  const [failed, setFailed] = useState(false);
  const artTone = useMemo(() => {
    const colors = [['168 45% 66%', '222 35% 23%', '224 38% 11%'], ['37 65% 64%', '223 34% 28%', '224 40% 12%'], ['196 49% 64%', '226 33% 25%', '226 43% 12%'], ['278 34% 67%', '226 31% 25%', '230 39% 12%']];
    let index = 0;
    for (let i = 0; i < project.slug.length; i++) index += project.slug.charCodeAt(i);
    return colors[index % colors.length];
  }, [project.slug]);
  return <div className={`project-art ${className}`} style={{ '--art-glow': artTone[0], '--art-base': artTone[1], '--art-deep': artTone[2] } as CSSProperties}>
    {project.thumbnailUrl && !failed ? <img src={project.thumbnailUrl} alt={`${project.title} preview`} onError={() => setFailed(true)} /> : <div className="art-object" aria-label={`${project.title} abstract artwork`}><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-cube"><span>{project.title.slice(0, 1).toUpperCase()}</span></span><span className="art-index">PH / {String(project.id).slice(0, 4).toUpperCase()}</span></div>}
    {project.videoLocked && <span className="art-lock"><LockKeyhole size={14} /> Preview locked</span>}
  </div>;
}

function ProjectCard({ project, showFavorite = false, favorite = false, onFavorite }: { project: Project; showFavorite?: boolean; favorite?: boolean; onFavorite?: () => void }) {
  return <article className="project-card" data-testid={`card-project-${project.id}`}>
    <div className="project-card-art"><Link href={`/projects/${project.slug}`} aria-label={`View ${project.title}`}><Artwork project={project} /></Link>
      {project.featured && <span className="featured-badge"><Sparkles size={12} /> Selected</span>}
      <span className={`access-badge ${project.access}`}>{project.access}</span>
      {showFavorite && <button onClick={onFavorite} className={`favorite-button ${favorite ? 'favorited' : ''}`} aria-label={favorite ? `Remove ${project.title} from favorites` : `Add ${project.title} to favorites`} data-testid={`button-favorite-${project.id}`}><Heart size={16} fill={favorite ? 'currentColor' : 'none'} /></button>}
    </div>
    <div className="project-card-content">
      <div className="project-card-meta"><span>{project.category}</span>{project.isNew && <span className="new-mark">NEW</span>}</div>
      <Link href={`/projects/${project.slug}`} className="project-card-title">{project.title}<ArrowUpRight size={16} /></Link>
      <p>{project.shortDescription}</p>
      <div className="project-card-bottom"><span>v{project.version || '—'}</span><span><Heart size={13} /> {project.favorites.toLocaleString()}</span></div>
    </div>
  </article>;
}

function useAuthAccount() {
  const session = useGetAuthSession({
    query: { queryKey: getGetAuthSessionQueryKey(), retry: false },
  });
  const user = session.data?.user ?? null;
  const isSignedIn = session.data?.authenticated === true && Boolean(user);
  const account = useGetAccount({
    query: {
      enabled: isSignedIn,
      queryKey: getGetAccountQueryKey(),
      retry: false,
    },
  });
  return {
    isSignedIn,
    isLoaded: !session.isLoading,
    user,
    account,
    session,
  };
}

function FavoriteControl({ slug, initial }: { slug: string; initial: boolean }) {
  const { isSignedIn } = useAuthAccount();
  const [, setLocation] = useLocation();
  const save = useSaveFavorite();
  const remove = useRemoveFavorite();
  const client = useQueryClient();
  const [favorite, setFavorite] = useState(initial);
  const [message, setMessage] = useState('');
  useEffect(() => setFavorite(initial), [initial]);
  function toggle() {
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    const action = favorite ? remove : save;
    action.mutate({ slug }, {
      onSuccess: () => {
        setFavorite(!favorite);
        setMessage(favorite ? 'Removed from your saved projects.' : 'Saved to your favorites.');
        client.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
        client.invalidateQueries({ queryKey: getGetAccountQueryKey() });
      },
      onError: () => setMessage('Your favorite could not be updated. Please try again.'),
    });
  }
  return <div><button className={`button ${favorite ? 'button-saved' : 'button-outline'}`} onClick={toggle} disabled={save.isPending || remove.isPending} aria-pressed={favorite} data-testid="button-toggle-favorite"><Heart size={16} fill={favorite ? 'currentColor' : 'none'} />{favorite ? 'Saved' : 'Save project'}</button>{message && <p className="action-message" role="status">{message}</p>}</div>;
}

function HomePage() {
  const projects = useListProjects({ featured: true }, { query: { queryKey: getListProjectsQueryKey({ featured: true }) } });
  const latest = useListProjects({ sort: 'latest' }, { query: { queryKey: getListProjectsQueryKey({ sort: 'latest' }) } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const selected = projects.data?.[0];
  return <Shell>
    <section className="hero-wrap">
      <div className="hero-copy">
        <div className="eyebrow hero-eyebrow"><span className="status-dot" /> A small catalog with a point of view</div>
        <h1>Software for<br /><em>the curious.</em></h1>
        <p>Original tools and creative software, built independently and released with care. Find the one that fits how you work.</p>
        <div className="hero-actions"><Link href="/projects" className="button button-dark">Explore projects <ArrowRight size={16} /></Link><Link href="/about" className="button button-quiet">What is Project Hub? <ArrowUpRight size={15} /></Link></div>
        <div className="hero-caption"><span>01 / THE COLLECTION</span><span>Independent releases, owner curated</span></div>
      </div>
      <div className="hero-visual" aria-label="Abstract dimensional software sculpture">
        <div className="hero-grid" />
        <div className="hero-halo halo-one" /><div className="hero-halo halo-two" />
        <div className="hero-orb"><div className="orb-face face-a" /><div className="orb-face face-b" /><div className="orb-face face-c" /><span className="orb-core" /></div>
        <div className="hero-float-card float-card-top"><span className="float-icon"><Command size={15} /></span><span>MADE TO DO<br /><b>one thing well</b></span></div>
        <div className="hero-float-card float-card-bottom"><span className="float-card-line" /><span>RELEASE  /  001<br /><b>Independent by design</b></span></div>
        <div className="visual-caption">FIG. 01 <span>TOOLS IN THEIR ELEMENT</span></div>
      </div>
    </section>
    <section className="intro-strip"><span className="eyebrow">A quieter kind of software directory</span><p>No open submissions. No endless marketplace. Just original work from one independent maker, presented clearly.</p><div className="intro-mark">PH<span>—</span>01</div></section>
    <section className="content-section featured-section">
      <div className="section-heading"><div><div className="eyebrow">The owner's selection</div><h2>Worth a closer look.</h2></div><Link className="text-link" href="/projects">View the catalog <ArrowRight size={15} /></Link></div>
      {projects.isLoading ? <LoadingGrid /> : projects.isError ? <ErrorState onRetry={() => projects.refetch()} /> : projects.data?.length ? <div className="project-grid">{projects.data.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}</div> : <EmptyState title="The featured shelf is clear" copy="Browse the full catalog to see every published release." />}
    </section>
    <section className="home-feature-band"><div className="band-topline"><span className="eyebrow">Built independently</span><span>NO CROWD-SOURCED LISTINGS</span></div><div className="band-main"><h2>Good tools stay<br />out of your way.</h2><p>Every release here is made, selected, and maintained by the owner. Straightforward details, clear access, and no mystery about what's available.</p><Link href="/about" className="button button-light">A little more about us <ArrowRight size={15} /></Link></div><div className="band-number">HUB<br /><span>01—∞</span></div></section>
    <section className="content-section latest-section">
      <div className="section-heading"><div><div className="eyebrow">Fresh from the workbench</div><h2>Recently released.</h2></div><Link className="text-link" href="/projects">All releases <ArrowRight size={15} /></Link></div>
      {latest.isLoading ? <LoadingGrid /> : latest.isError ? <ErrorState onRetry={() => latest.refetch()} /> : latest.data?.length ? <div className="project-grid">{latest.data.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}</div> : <EmptyState title="New work is on its way" />}
    </section>
    <section className="home-cta"><div className="cta-orbit"><span /></div><div><div className="eyebrow">Your own little corner</div><h2>Save what speaks to you.</h2><p>Sign in to keep favorites and revisit the releases you love.</p></div><Link href="/sign-up" className="button button-dark">Create an account <ArrowRight size={15} /></Link></section>
    <div className="service-footnote"><span className={`status-dot ${health.isError ? 'status-offline' : ''}`} /> {health.isLoading ? 'Checking catalog status' : health.isError ? 'Catalog service is temporarily unavailable' : `Catalog service: ${health.data?.status || 'available'}`}</div>
  </Shell>;
}

function CatalogPage({ mode = 'all' }: { mode?: 'all' | 'free' | 'premium' | 'search' }) {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const searchValue = params.get('q') || '';
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const { isSignedIn } = useAuthAccount();
  const access: 'all' | 'free' | 'premium' = mode === 'free' || mode === 'premium' ? mode : 'all';
  const projectParams = { q: mode === 'search' ? searchValue || undefined : undefined, category: category === 'all' ? undefined : category, access, sort };
  const categoryParams = { access, sort: 'latest' as const };
  const projects = useListProjects(projectParams, { query: { queryKey: getListProjectsQueryKey(projectParams) } });
  const categoryProjects = useListProjects(categoryParams, { query: { queryKey: getListProjectsQueryKey(categoryParams) } });
  const favorites = useListFavorites({ query: { enabled: isSignedIn, queryKey: getListFavoritesQueryKey(), retry: false } });
  const save = useSaveFavorite();
  const remove = useRemoveFavorite();
  const client = useQueryClient();
  const favoriteSlugs = useMemo(() => new Set((favorites.data || []).map(project => project.slug)), [favorites.data]);
  const categories = useMemo(() => Array.from(new Set((categoryProjects.data || []).map(p => p.category))).sort(), [categoryProjects.data]);
  const titles = { all: ['The catalog', 'A collection of original software, selected and maintained by its maker.'], free: ['Free releases', 'Useful things, available without a premium subscription.'], premium: ['Premium releases', 'More ambitious tools, with access details kept clear.'], search: ['Search the catalog', searchValue ? `Results for “${searchValue}”` : 'Look for a tool, a category, or a small idea with a big use.'] } as const;
  const [title, copy] = titles[mode];
  function toggleFavorite(slug: string) {
    if (!isSignedIn) { setLocation('/sign-in'); return; }
    const action = favoriteSlugs.has(slug) ? remove : save;
    action.mutate({ slug }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListFavoritesQueryKey() }); client.invalidateQueries({ queryKey: getGetAccountQueryKey() }); } });
  }
  return <Shell><div className="content-page">
    <PageHeading kicker={mode === 'search' ? 'DISCOVER' : 'OWNER-CURATED RELEASES'} title={title} copy={copy} aside={<SearchBox />} />
    <div className="catalog-toolbar"><div className="catalog-count">{projects.data?.length ?? '—'} <span>releases</span></div><div className="filters"><label className="select-wrap"><Filter size={14} /><span className="sr-only">Category</span><select aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)} data-testid="select-category"><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={13} /></label><label className="select-wrap"><span className="sr-only">Sort</span><select value={sort} onChange={e => setSort(e.target.value as 'latest' | 'popular')} aria-label="Sort projects" data-testid="select-sort"><option value="latest">Latest</option><option value="popular">Most popular</option></select><ChevronDown size={13} /></label></div></div>
    {projects.isLoading ? <LoadingGrid /> : projects.isError ? <ErrorState onRetry={() => projects.refetch()} /> : projects.data?.length ? <div className="project-grid">{projects.data.map(p => <ProjectCard key={p.id} project={p} showFavorite favorite={favoriteSlugs.has(p.slug)} onFavorite={() => toggleFavorite(p.slug)} />)}</div> : <EmptyState title={searchValue ? 'No matches this time' : 'No releases in this view'} copy={searchValue ? 'Try another phrase or browse the full catalog.' : 'There are no published projects to show here yet.'} />}
    {projects.data?.length ? <p className="catalog-endnote">Showing published releases only <span>·</span> curated by the owner</p> : null}
  </div></Shell>;
}

function ProjectDetailPage({ params }: { params: { slug?: string } }) {
  const slug = params.slug || '';
  const project = useGetProject(slug, { query: { enabled: !!slug, queryKey: getGetProjectQueryKey(slug), retry: false } });
  const view = useRecordProjectView();
  const download = useRequestProjectDownload();
  const [downloadMessage, setDownloadMessage] = useState('');
  useEffect(() => { if (slug) view.mutate({ slug }); }, [slug]);
  if (project.isLoading) return <Shell><div className="detail-loading"><div className="skeleton detail-loading-art" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div></Shell>;
  if (project.isError || !project.data) return <Shell><div className="content-page"><ErrorState message="This release may have moved, or is not currently published." onRetry={() => project.refetch()} /><Link href="/projects" className="text-link centered-link"><ArrowLeft size={15} /> Back to the catalog</Link></div></Shell>;
  const p = project.data;
  function requestDownload() {
    if (!p.fileAvailable) { setDownloadMessage('The owner has not attached a release file for this project yet.'); return; }
    download.mutate({ slug }, { onSuccess: result => {
      if (result.downloadUrl) { setDownloadMessage('Your download is ready.'); window.open(result.downloadUrl, '_blank', 'noopener,noreferrer'); }
      else setDownloadMessage(result.message || 'A download is not available for this release right now.');
    }, onError: () => setDownloadMessage('The download could not be requested. Please try again later.') });
  }
  return <Shell><div className="content-page detail-page">
    <Link href="/projects" className="back-link"><ArrowLeft size={15} /> Back to catalog</Link>
    <div className="detail-hero"><div className="detail-visual"><Artwork project={p} className="detail-artwork" /><div className="detail-art-caption"><span>PROJECT / {p.slug.toUpperCase()}</span><span>VERSION {p.version}</span></div></div>
      <div className="detail-summary"><div className="eyebrow">{p.category} <span className="separator-dot">·</span> RELEASED {formatDate(p.releaseDate)}</div><h1>{p.title}</h1><p className="detail-lede">{p.shortDescription}</p><div className="detail-labels"><span className={`access-badge ${p.access}`}>{p.access} access</span><span>Version {p.version}</span>{p.fileSize && <span>{p.fileSize}</span>}</div><div className="detail-actions"><button className="button button-dark" onClick={requestDownload} disabled={download.isPending || !p.fileAvailable} data-testid="button-download-project"><ArrowDownToLine size={16} />{download.isPending ? 'Preparing…' : p.fileAvailable ? 'Get this release' : 'File unavailable'}</button><FavoriteControl slug={p.slug} initial={p.isFavorite} /></div>{(!p.fileAvailable || downloadMessage) && <div className="download-note" role="status"><FileQuestion size={15} />{p.fileAvailable ? downloadMessage : 'The owner has not attached a release file for this project yet.'}</div>}<div className="detail-stats"><span><Eye size={14} />{p.views.toLocaleString()} views</span><span><ArrowDownToLine size={14} />{p.downloads.toLocaleString()} downloads</span><span><Heart size={14} />{p.favorites.toLocaleString()} saves</span></div></div>
    </div>
     <div className="detail-columns"><article className="detail-copy"><div className="eyebrow">THE PROJECT</div><h2>Made for a reason.</h2><p className="long-description">{p.description}</p>{p.whatsNew && <section className="detail-subsection"><div className="eyebrow">LATEST UPDATE · {formatDate(p.updatedAt)}</div><h3>What’s new</h3><p>{p.whatsNew}</p></section>}{p.changelog?.length > 0 && <section className="detail-subsection"><h3>Release notes</h3><ul className="detail-list">{p.changelog.map((entry, i) => <li key={i}>{entry}</li>)}</ul></section>}</article>
      <aside className="detail-aside"><section className="spec-panel"><div className="eyebrow">AT A GLANCE</div><dl><div><dt>Category</dt><dd>{p.category}</dd></div><div><dt>Access</dt><dd>{p.access}</dd></div><div><dt>Version</dt><dd>{p.version}</dd></div><div><dt>File size</dt><dd>{p.fileSize || 'Not listed'}</dd></div><div><dt>Updated</dt><dd>{formatDate(p.updatedAt)}</dd></div></dl></section>{p.supportedDevices?.length > 0 && <section className="spec-panel"><div className="eyebrow">SUPPORTED ON</div><div className="tag-list">{p.supportedDevices.map(x => <span key={x}>{x}</span>)}</div></section>}{p.requirements?.length > 0 && <section className="spec-panel"><div className="eyebrow">REQUIREMENTS</div><ul className="detail-list compact-list">{p.requirements.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}{p.tags?.length > 0 && <section className="spec-panel"><div className="eyebrow">FILED UNDER</div><div className="tag-list">{p.tags.map(x => <span key={x}>#{x}</span>)}</div></section>}</aside>
    </div>
    {p.screenshots?.length > 0 && <section className="screenshot-section"><div className="eyebrow">A CLOSER LOOK</div><h2>Inside the project.</h2><div className="screenshot-grid">{p.screenshots.map((src, i) => <img key={src} src={src} alt={`${p.title} screenshot ${i + 1}`} loading="lazy" />)}</div></section>}
    <section className="detail-endcap"><span className="eyebrow">MORE TO EXPLORE</span><h2>Keep looking around.</h2><Link className="button button-outline" href="/projects">Back to all projects <ArrowRight size={15} /></Link></section>
  </div></Shell>;
}

function SignedOutPrompt({ title, copy }: { title: string; copy: string }) {
  return <div className="state-panel"><span className="state-icon"><LockKeyhole /></span><h2>{title}</h2><p>{copy}</p><div className="state-actions"><Link href="/sign-in" className="button button-dark">Sign in</Link><Link href="/sign-up" className="button button-outline">Create account</Link></div></div>;
}

function AccountPage() {
  const { isSignedIn, user, account } = useAuthAccount();
  if (!isSignedIn) return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title="A place for your projects." copy="Sign in to see your saved projects and account details." /><SignedOutPrompt title="Your account lives here" copy="Sign in to keep track of favorite releases and download history." /></div></Shell>;
  if (account.isLoading) return <Shell><div className="content-page"><div className="skeleton skeleton-line" /><div className="skeleton account-skeleton" /></div></Shell>;
  if (account.isError) return <Shell><div className="content-page"><PageHeading title="Your account" /><ErrorState message="We couldn't load your account details. Your sign-in may have expired." onRetry={() => account.refetch()} /></div></Shell>;
  const data = account.data;
  return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title={`Good to see you${data?.displayName ? `, ${data.displayName.split(' ')[0]}` : ''}.`} copy="Your personal corner of the catalog." />
     <div className="account-card"><div className="account-identity"><span className="account-avatar">{data?.displayName?.[0] || user?.displayName?.[0] || 'P'}</span><div><h2>{data?.displayName || user?.displayName || 'Project Hub member'}</h2><p>{data?.email || user?.email}</p></div>{data?.isAdmin && <span className="owner-badge"><ShieldCheck size={14} /> Owner</span>}</div><div className="account-numbers"><div><span>{data?.favoriteCount ?? 0}</span><small>Favorites</small></div><div><span>{data?.downloadCount ?? 0}</span><small>Downloads</small></div><div><span>Active</span><small>Account</small></div></div></div>
    <div className="account-links"><Link href="/favorites" className="account-link"><span className="account-link-icon"><Heart /></span><span><b>Saved projects</b><small>Pick up where your curiosity left off.</small></span><ArrowRight size={17} /></Link><Link href="/downloads" className="account-link"><span className="account-link-icon"><ArrowDownToLine /></span><span><b>Download history</b><small>Revisit releases you've requested.</small></span><ArrowRight size={17} /></Link><Link href="/notifications" className="account-link"><span className="account-link-icon"><Bell /></span><span><b>Notifications</b><small>Updates from the catalog.</small></span><ArrowRight size={17} /></Link><Link href="/subscription" className="account-link"><span className="account-link-icon"><Settings2 /></span><span><b>Access & subscription</b><small>See your current access status.</small></span><ArrowRight size={17} /></Link></div>
  </div></Shell>;
}

function FavoritesPage() {
  const { isSignedIn } = useAuthAccount();
  const favorites = useListFavorites({ query: { enabled: isSignedIn, queryKey: getListFavoritesQueryKey(), retry: false } });
  if (!isSignedIn) return <Shell><div className="content-page"><PageHeading kicker="YOUR COLLECTION" title="Saved for later." /><SignedOutPrompt title="Keep your shortlist close" copy="Sign in to save the releases you want to come back to." /></div></Shell>;
  return <Shell><div className="content-page"><PageHeading kicker="YOUR COLLECTION" title="Saved for later." copy="The projects you wanted to keep close." />{favorites.isLoading ? <LoadingGrid /> : favorites.isError ? <ErrorState onRetry={() => favorites.refetch()} /> : favorites.data?.length ? <div className="project-grid">{favorites.data.map(p => <ProjectCard key={p.id} project={p} />)}</div> : <EmptyState title="Your shortlist is empty" copy="Tap the heart on any project to save it here." />}</div></Shell>;
}

function DownloadsPage() {
  const { isSignedIn } = useAuthAccount();
  const downloads = useListDownloads({ query: { enabled: isSignedIn, queryKey: getListDownloadsQueryKey(), retry: false } });
  if (!isSignedIn) return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title="Download history." /><SignedOutPrompt title="Sign in to view downloads" copy="Your requested downloads will be listed here when you sign in." /></div></Shell>;
  return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title="Download history." copy="A record of releases requested from Project Hub." />
    {downloads.isLoading ? <div className="skeleton-list">{[1,2,3].map(n=><div className="skeleton skeleton-line" key={n} />)}</div> : downloads.isError ? <ErrorState onRetry={() => downloads.refetch()} /> : downloads.data?.length ? <div className="record-list">{downloads.data.map(item => <div className="record-row" key={item.id}><span className="record-icon"><ArrowDownToLine size={17} /></span><span><b>{item.projectTitle}</b><small>Release requested · {formatDate(item.createdAt)}</small></span><Link href={`/projects/${item.projectSlug}`} className="text-link">View project <ArrowUpRight size={14} /></Link></div>)}</div> : <EmptyState title="No downloads yet" copy="When you request an available release, it will appear here." />}
  </div></Shell>;
}

function NotificationsPage() {
  const { isSignedIn } = useAuthAccount();
  const notifications = useListNotifications({ query: { enabled: isSignedIn, queryKey: getListNotificationsQueryKey(), retry: false } });
  if (!isSignedIn) return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title="Notifications." /><SignedOutPrompt title="Sign in to see updates" copy="Catalog updates and account notifications will appear here." /></div></Shell>;
  return <Shell><div className="content-page"><PageHeading kicker="YOUR ACCOUNT" title="Notifications." copy="A quiet place for updates related to your account." />{notifications.isLoading ? <div className="skeleton-list">{[1,2,3].map(n=><div className="skeleton skeleton-line" key={n} />)}</div> : notifications.isError ? <ErrorState onRetry={() => notifications.refetch()} /> : notifications.data?.length ? <div className="record-list">{notifications.data.map(item => <div className={`notification-row ${item.read ? '' : 'unread'}`} key={item.id}><span className="notification-mark">{item.read ? <Check size={14} /> : <span />}</span><div><b>{item.title}</b><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div></div>)}</div> : <EmptyState title="All quiet here" copy="There are no notifications for your account." />}</div></Shell>;
}

function SubscriptionPage() {
  const { isSignedIn } = useAuthAccount();
  const subscription = useGetSubscription({ query: { enabled: isSignedIn, queryKey: getGetSubscriptionQueryKey(), retry: false } });
  if (!isSignedIn) return <Shell><div className="content-page"><PageHeading kicker="ACCESS" title="Premium access." copy="Review the access model for premium releases." /><SignedOutPrompt title="Sign in to check your access" copy="Your current account access is shown here." /></div></Shell>;
  return <Shell><div className="content-page"><PageHeading kicker="ACCESS" title="Premium access." copy="No billing happens on this page. It reflects the access status returned for your account." />
    {subscription.isLoading ? <div className="skeleton subscription-skeleton" /> : subscription.isError ? <ErrorState message="We couldn't load your access status." onRetry={() => subscription.refetch()} /> : <div className="subscription-panel"><div className="subscription-emblem"><Layers3 size={24} /></div><div><div className="eyebrow">ACCOUNT ACCESS</div><h2>{subscription.data?.premiumEnabled ? 'Premium access enabled' : 'Free access'}</h2><p>{subscription.data?.premiumEnabled ? 'Your account currently has access to premium releases.' : 'Your account can access free releases. Premium release access is not currently enabled.'}</p></div><div className="subscription-state"><span className={`status-dot ${subscription.data?.premiumEnabled ? '' : 'status-muted'}`} />{subscription.data?.status?.replace('_', ' ') || 'inactive'}</div>{subscription.data?.plan && <div className="subscription-meta"><span>Plan</span><b>{subscription.data.plan}</b></div>}{subscription.data?.expiresAt && <div className="subscription-meta"><span>Access through</span><b>{formatDate(subscription.data.expiresAt)}</b></div>}<p className="subscription-notice">There is no self-service purchase or subscription change flow available here.</p></div>}
  </div></Shell>;
}

function AboutPage() {
  return <Shell><div className="content-page editorial-page"><PageHeading kicker="A NOTE FROM THE MAKER" title={<>An independent home<br />for useful ideas.</>} copy="Project Hub is a focused launchpad for original tools and creative software." />
    <div className="editorial-lead"><span className="large-quote">“</span><p>Everything here started with a small problem worth solving — and enough curiosity to build a tool around it.</p></div>
    <div className="editorial-grid"><section><span className="eyebrow">01 / THE COLLECTION</span><h2>Not a marketplace.</h2><p>Project Hub is an owner-curated catalog, not a public submission directory. Each listed release is an original project made and maintained by the owner.</p></section><section><span className="eyebrow">02 / CLEAR ACCESS</span><h2>Know before you open.</h2><p>Each project page explains whether a release is free or premium, plus the version, requirements, and file availability when that information exists.</p></section><section><span className="eyebrow">03 / THE ACCOUNT</span><h2>Your saved corner.</h2><p>Visitors can browse the catalog. Sign in to save favorites and see account history. Only the owner administrator can manage releases.</p></section></div>
    <section className="editorial-end"><div className="eyebrow">ALWAYS IN PROGRESS</div><h2>Small releases.<br />Real intent.</h2><Link href="/projects" className="button button-dark">Explore what’s here <ArrowRight size={15} /></Link></section>
  </div></Shell>;
}

const legalCopy: Record<string, { title: string; label: string; paragraphs: string[] }> = {
  privacy: { title: 'Privacy, without the fine print fog.', label: 'PRIVACY', paragraphs: ['Project Hub uses account information to provide sign-in, favorites, download history, and related account features. Passwords are stored as scrypt hashes, and sign-in sessions are held server-side with an HttpOnly cookie in the browser.', 'Project details and account data are stored to operate the catalog. Hosting and operational services may process limited technical data needed to run the site.', 'For a privacy question or request, use the contact method made available by the owner. A response channel is not configured in this catalog yet.'] },
  terms: { title: 'A few clear terms.', label: 'TERMS OF USE', paragraphs: ['Project Hub presents owner-created software releases for browsing and, where available, access. Project information is provided for the specific release shown.', 'Do not misuse the site, attempt to interfere with its operation, or use a release in a way that violates applicable law. Each project may have additional terms shown with that release.', 'The owner may update, withdraw, or archive a release. Availability and project details can change over time.'] },
  refunds: { title: 'Refund information.', label: 'REFUNDS', paragraphs: ['Project Hub does not process purchases or subscription changes through this interface. No checkout or payment flow is available here.', 'If a premium purchase was made through another channel, refund eligibility is governed by the terms of that purchase channel. No refund request form is available in this catalog.'] },
  disclaimer: { title: 'Useful context before you use a release.', label: 'DISCLAIMER', paragraphs: ['Projects are provided as described on their individual pages. Compatibility, requirements, and availability can vary by release and may change with updates.', 'Unless a project page says otherwise, information is supplied for general guidance. The catalog does not guarantee uninterrupted availability or suitability for a particular purpose.', 'A visible download control is enabled only when the API indicates that a file is available. A missing file is not replaced with a placeholder download.'] },
};

function LegalPage({ page }: { page: keyof typeof legalCopy }) {
  const content = legalCopy[page];
  return <Shell><div className="content-page legal-page"><PageHeading kicker={content.label} title={content.title} copy="Last reviewed: current catalog release" /><div className="legal-content">{content.paragraphs.map((p, i) => <section key={i}><span className="legal-index">0{i + 1}</span><p>{p}</p></section>)}</div><div className="legal-note"><CircleHelp size={16} /><span>Questions? Contact details have not been configured in this catalog.</span></div></div></Shell>;
}

function AdminLoginPage() {
  const { isSignedIn, user } = useAuthAccount();
  return <Shell><div className="content-page owner-access-page"><div className="owner-access-card"><span className="owner-access-mark"><ShieldCheck /></span><div className="eyebrow">OWNER ACCESS</div><h1>Behind the catalog.</h1><p>Project management is reserved for the owner administrator account. The server checks this account's role before every management action.</p>{isSignedIn && user?.role === 'admin' ? <Link className="button button-dark" href="/admin">Continue to owner studio <ArrowRight size={15} /></Link> : isSignedIn ? <p className="admin-access-note">This account does not have project-management access.</p> : <Link className="button button-dark" href="/sign-in">Sign in to continue <ArrowRight size={15} /></Link>}<Link href="/" className="text-link">Return to the public catalog <ArrowLeft size={14} /></Link></div></div></Shell>;
}

function AdminPage() {
  const { isSignedIn, account } = useAuthAccount();
  const isOwner = !!account.data?.isAdmin;
  const overview = useGetAdminOverview({ query: { enabled: isOwner, queryKey: getGetAdminOverviewQueryKey(), retry: false } });
  const projects = useListAdminProjects({ query: { enabled: isOwner, queryKey: getListAdminProjectsQueryKey(), retry: false } });
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const publication = useSetProjectPublication();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [formError, setFormError] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [access, setAccess] = useState<'free' | 'premium'>('free');
  const [success, setSuccess] = useState('');
  if (!isSignedIn) return <Redirect to="/admin/login" />;
  if (account.isLoading) return <Shell><div className="content-page"><div className="skeleton account-skeleton" /></div></Shell>;
  if (account.isError || !isOwner) return <Shell><div className="content-page"><div className="owner-denied"><ShieldCheck size={24} /><div className="eyebrow">OWNER STUDIO</div><h1>Access not available.</h1><p>This account does not have the administrator role required to manage the catalog.</p><Link href="/projects" className="button button-outline">Back to public catalog</Link></div></div></Shell>;
  function resetForm() { setCreating(false); setEditing(null); setTitle(''); setSlug(''); setShortDescription(''); setDescription(''); setCategory(''); setAccess('free'); setFormError(''); }
  function startEdit(p: Project) { setEditing(p); setCreating(false); setTitle(p.title); setSlug(p.slug); setShortDescription(p.shortDescription); setDescription(p.description); setCategory(p.category); setAccess(p.access); setSuccess(''); }
  function submitProject(e: FormEvent) {
    e.preventDefault(); setFormError(''); setSuccess('');
    if (editing) {
      const data: ProjectUpdate = { title, shortDescription, description, category, access };
      update.mutate({ slug: editing.slug, data }, { onSuccess: () => { setSuccess('Project updated.'); resetForm(); client.invalidateQueries({ queryKey: getListAdminProjectsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); }, onError: () => setFormError('The project could not be updated. Check the details and try again.') });
    } else {
      const data: ProjectInput = { title, slug, shortDescription, description, category, access, tags: [], featured: false, isNew: false };
      create.mutate({ data }, { onSuccess: () => { setSuccess('Draft created.'); resetForm(); client.invalidateQueries({ queryKey: getListAdminProjectsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); }, onError: () => setFormError('The project could not be created. Check the required fields and try again.') });
    }
  }
  function togglePublish(p: Project) {
    const published = p.status !== 'published';
    publication.mutate({ slug: p.slug, data: { published } }, { onSuccess: () => { setSuccess(published ? 'Project published.' : 'Project unpublished.'); client.invalidateQueries({ queryKey: getListAdminProjectsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); }, onError: () => setFormError('The publication status could not be changed.') });
  }
  function archiveProject(p: Project) {
    if (!window.confirm(`Archive “${p.title}”? It will no longer appear in the public catalog.`)) return;
    archive.mutate({ slug: p.slug }, { onSuccess: () => { setSuccess('Project archived.'); client.invalidateQueries({ queryKey: getListAdminProjectsQueryKey() }); client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); }, onError: () => setFormError('The project could not be archived.') });
  }
  return <Shell><div className="content-page admin-page"><PageHeading kicker="OWNER STUDIO" title="The workbench." copy="Manage original releases and their public visibility." aside={<button className="button button-dark" onClick={() => { resetForm(); setCreating(true); }} data-testid="button-create-project"><span>+</span> New project</button>} />
    {overview.isLoading ? <div className="admin-metrics">{[1,2,3,4].map(i=><div className="skeleton metric-skeleton" key={i} />)}</div> : overview.isError ? <div className="admin-inline-error">Overview metrics are temporarily unavailable.</div> : <div className="admin-metrics">{[['Projects', overview.data?.projects], ['Published', overview.data?.published], ['Views', overview.data?.views], ['Downloads', overview.data?.downloads]].map(([name, value]) => <div className="metric-card" key={name}><span>{name}</span><b>{Number(value || 0).toLocaleString()}</b></div>)}</div>}
    {success && <div className="admin-success" role="status"><Check size={16} />{success}</div>}
    {(creating || editing) && <form className="admin-form" onSubmit={submitProject}><div className="form-heading"><div><div className="eyebrow">{editing ? 'EDIT RELEASE' : 'NEW DRAFT'}</div><h2>{editing ? `Edit ${editing.title}` : 'Start with the essentials.'}</h2></div><button type="button" className="icon-button" onClick={resetForm} aria-label="Close project form"><X size={17} /></button></div>
      <div className="form-grid"><label>Project title<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={120} data-testid="input-admin-title" /></label>{!editing && <label>Slug<input value={slug} onChange={e=>setSlug(e.target.value)} required minLength={2} maxLength={100} pattern="[a-z0-9-]+" placeholder="my-project" data-testid="input-admin-slug" /></label>}<label>Short description<input value={shortDescription} onChange={e=>setShortDescription(e.target.value)} required maxLength={220} data-testid="input-admin-short-description" /></label><label>Category<input value={category} onChange={e=>setCategory(e.target.value)} required maxLength={60} data-testid="input-admin-category" /></label><label className="span-two">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} required maxLength={10000} rows={5} data-testid="input-admin-description" /></label><label>Access<select value={access} onChange={e=>setAccess(e.target.value as 'free'|'premium')}><option value="free">Free</option><option value="premium">Premium</option></select></label></div>
      <p className="form-note">New projects are created as drafts. Image and file uploads are not available from this interface.</p>{formError && <div className="admin-inline-error" role="alert">{formError}</div>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={resetForm}>Cancel</button><button type="submit" className="button button-dark" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}</button></div>
    </form>}
    <div className="admin-list-heading"><div><div className="eyebrow">THE CATALOG</div><h2>Projects</h2></div>{projects.isLoading && <span className="eyebrow">Loading</span>}</div>
    {projects.isLoading ? <div className="skeleton-list">{[1,2,3].map(n=><div className="skeleton skeleton-line" key={n} />)}</div> : projects.isError ? <ErrorState message="Owner project data could not be loaded." onRetry={() => projects.refetch()} /> : projects.data?.length ? <div className="admin-project-list">{projects.data.map(p => <div className="admin-project-row" key={p.id}><Artwork project={p} className="admin-thumb" /><div className="admin-project-info"><b>{p.title}</b><span>{p.category} · v{p.version}</span></div><span className={`status-pill ${p.status}`}>{p.status}</span><span className={`access-badge ${p.access}`}>{p.access}</span><div className="admin-row-actions"><button className="text-button" onClick={() => startEdit(p)} data-testid={`button-edit-${p.id}`}>Edit</button>{p.status !== 'archived' && <button className="text-button" onClick={() => togglePublish(p)} disabled={publication.isPending} data-testid={`button-publish-${p.id}`}>{p.status === 'published' ? 'Unpublish' : 'Publish'}</button>}{p.status !== 'archived' && <button className="text-button danger-text" onClick={() => archiveProject(p)} disabled={archive.isPending} data-testid={`button-archive-${p.id}`}>Archive</button>}</div></div>)}</div> : <EmptyState title="No projects yet" copy="Create a draft to begin building your owner-curated catalog." />}
    {formError && !creating && !editing && <div className="admin-inline-error" role="alert">{formError}</div>}
  </div></Shell>;
}

function authErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string' && message.trim()) return message;
    }
  }
  return fallback;
}

function AuthPage({ kind }: { kind: 'signin' | 'signup' }) {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const { isLoaded, isSignedIn, user } = useAuthAccount();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerSetupToken, setOwnerSetupToken] = useState('');
  const [showOwnerSetup, setShowOwnerSetup] = useState(false);
  const [error, setError] = useState('');
  const busy = signIn.isPending || signUp.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      let destination = '/account';
      if (kind === 'signin') {
        const result = await signIn.mutateAsync({ data: { email, password } });
        if (result.user.role === 'admin') destination = '/admin';
      } else {
        const result = await signUp.mutateAsync({
          data: {
            email,
            displayName,
            password,
            ...(ownerSetupToken ? { ownerSetupToken } : {}),
          },
        });
        if (result.user.role === 'admin') destination = '/admin';
      }
      client.clear();
      setLocation(destination);
    } catch (submitError) {
      setError(authErrorMessage(
        submitError,
        kind === 'signin' ? 'Email or password is incorrect.' : 'The account could not be created. Please check the details and try again.',
      ));
    }
  }

  if (isLoaded && isSignedIn) return <Redirect to={user?.role === 'admin' ? '/admin' : '/account'} />;
  return <div className="auth-page">
    <Link href="/" className="auth-back"><ArrowLeft size={14} /> Project Hub</Link>
    <div className="auth-side"><div className="eyebrow">A SMALL CATALOG, YOURS TO KEEP</div><h1>Make space for<br /><em>good tools.</em></h1><p>Sign in to save thoughtful software for later.</p><div className="auth-side-art"><div className="auth-mini-orb" /><span>INDEPENDENT / ORIGINAL / OWNER CURATED</span></div></div>
    <div className="auth-form-side">
      <form className="auth-custom-form" onSubmit={submit}>
        <div className="eyebrow">{kind === 'signin' ? 'YOUR ACCOUNT' : 'GET STARTED'}</div>
        <h2>{kind === 'signin' ? 'Welcome back.' : 'Create your account.'}</h2>
        <p className="auth-form-copy">{kind === 'signin' ? 'Sign in to return to your saved projects.' : 'Save favorites and keep your account history in one place.'}</p>
        {kind === 'signup' && <label htmlFor="auth-display-name">Name<input id="auth-display-name" name="displayName" autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={100} data-testid="input-signup-name" /></label>}
        <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} data-testid={`input-${kind}-email`} /></label>
        <label htmlFor="auth-password">Password<input id="auth-password" name="password" type="password" autoComplete={kind === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} data-testid={`input-${kind}-password`} /><small>Use at least 12 characters.</small></label>
        {kind === 'signup' && <div className="owner-setup-toggle">
          <button id="owner-setup-trigger" type="button" className="owner-setup-trigger" onClick={() => setShowOwnerSetup(value => !value)} aria-expanded={showOwnerSetup} aria-controls="owner-setup-panel">
            <span className="owner-setup-trigger-label"><ShieldCheck size={16} aria-hidden="true" />Setting up the owner account?</span>
            <ChevronDown size={16} className={showOwnerSetup ? 'owner-setup-chevron owner-setup-chevron-open' : 'owner-setup-chevron'} aria-hidden="true" />
          </button>
          <div id="owner-setup-panel" className="owner-setup-panel" hidden={!showOwnerSetup}>
            <p className="owner-setup-note">Owner setup requires the configured owner email and private setup token. Regular accounts cannot claim admin access.</p>
            <label htmlFor="owner-setup-token">Owner setup token<input id="owner-setup-token" name="ownerSetupToken" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={ownerSetupToken} onChange={e => setOwnerSetupToken(e.target.value)} maxLength={512} /><small>The token is checked by the server and is never included in the page source.</small></label>
          </div>
        </div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="button button-dark auth-submit" disabled={busy} data-testid={`button-${kind}-submit`}>{busy ? 'Please wait…' : kind === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></button>
        <p className="auth-switch">{kind === 'signin' ? <>New to Project Hub? <Link href="/sign-up">Create an account</Link></> : <>Already have an account? <Link href="/sign-in">Sign in</Link></>}</p>
      </form>
      <p className="auth-footnote">Accounts use server-side sessions. Only the owner administrator can manage projects.</p>
    </div>
  </div>;
}

function NotFoundPage() {
  return <Shell><div className="not-found"><span className="eyebrow">404 / NOT ON THE MAP</span><h1>That page<br /><em>isn't here.</em></h1><p>It may have moved, or perhaps the path was a little off.</p><Link href="/" className="button button-dark"><ArrowLeft size={15} /> Back to Project Hub</Link><div className="not-found-orb" /></div></Shell>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuthAccount();
  if (isLoaded && isSignedIn) return <Redirect to="/account" />;
  return <HomePage />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/projects" component={() => <CatalogPage />} />
    <Route path="/free" component={() => <CatalogPage mode="free" />} />
    <Route path="/premium" component={() => <CatalogPage mode="premium" />} />
    <Route path="/search" component={() => <CatalogPage mode="search" />} />
    <Route path="/projects/:slug" component={ProjectDetailPage} />
    <Route path="/subscription" component={SubscriptionPage} />
    <Route path="/sign-in/*?" component={() => <AuthPage kind="signin" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage kind="signup" />} />
    <Route path="/account" component={AccountPage} />
    <Route path="/favorites" component={FavoritesPage} />
    <Route path="/downloads" component={DownloadsPage} />
    <Route path="/notifications" component={NotificationsPage} />
    <Route path="/admin/login" component={AdminLoginPage} />
    <Route path="/admin" component={AdminPage} />
    <Route path="/about" component={AboutPage} />
    <Route path="/privacy" component={() => <LegalPage page="privacy" />} />
    <Route path="/terms" component={() => <LegalPage page="terms" />} />
    <Route path="/refunds" component={() => <LegalPage page="refunds" />} />
    <Route path="/disclaimer" component={() => <LegalPage page="disclaimer" />} />
    <Route component={NotFoundPage} />
  </Switch></RoutedErrorBoundary>;
}

function App() {
  return <WouterRouter base={basePath}><QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider></WouterRouter>;
}

export default App;