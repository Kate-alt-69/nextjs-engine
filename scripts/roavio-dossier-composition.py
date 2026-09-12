from pathlib import Path

path = Path("app/roavio/CityDossier.tsx")
text = path.read_text(encoding="utf-8")

old = 'import { CityThumb } from "./CityThumb";\n'
new = old + 'import { CityDossierBackdrop } from "./CityDossierBackdrop";\n'
assert old in text, "CityThumb import anchor missing"
text = text.replace(old, new, 1)

old = '  const cityBackdrop = `/api/city-photo?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&slot=0&width=960&height=540&v=9`;\n'
assert old in text, "old cityBackdrop constant missing"
text = text.replace(old, "", 1)

old = '''        style: {
          backgroundImage: `linear-gradient(rgba(7,17,14,.70), rgba(7,17,14,.82)), url("${cityBackdrop}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        },
'''
assert old in text, "old root wallpaper style missing"
text = text.replace(old, "", 1)

old = '''      children: [
        createRoavioNav(locale),
'''
new = '''      children: [
        { type: "slot", props: { name: "pageBackdrop" } },
        createRoavioNav(locale),
'''
assert old in text, "root children anchor missing"
text = text.replace(old, new, 1)

old = '''                    ...(city.summary ? [{ type: "text", props: { content: city.summary, size: ".92rem", lineHeight: 1.6, maxW: "650px", color: "rgba(255,255,255,.92)" } } as SchemaNode] : []),
'''
assert old in text, "duplicate hero summary missing"
text = text.replace(old, "", 1)

old = '''    slots: {
      heroImage: (
'''
new = '''    slots: {
      pageBackdrop: (
        <CityDossierBackdrop city={city.name} country={city.country} />
      ),
      heroImage: (
'''
assert old in text, "slots anchor missing"
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")

Path("app/roavio/CityDossierBackdrop.tsx").write_text(r'''"use client";

import { useMemo, useState } from "react";

const PHOTO_VERSION = "10";

function photoUrl(city: string, country: string, slot: 0 | 1, width: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: String(width),
    height: String(Math.round(width * 0.72)),
    v: PHOTO_VERSION,
  });
  return `/api/city-photo?${params.toString()}`;
}

export function CityDossierBackdrop({ city, country }: { city: string; country: string }) {
  const [slot, setSlot] = useState<0 | 1>(1);
  const [failed, setFailed] = useState(false);

  const sources = useMemo(() => ({
    sm: photoUrl(city, country, slot, 720),
    md: photoUrl(city, country, slot, 1280),
    lg: photoUrl(city, country, slot, 1800),
  }), [city, country, slot]);

  if (failed) return <div className="rv-dossier-backdrop rv-dossier-backdrop--fallback" aria-hidden="true" />;

  return (
    <div className="rv-dossier-backdrop" aria-hidden="true">
      <img
        src={sources.md}
        srcSet={`${sources.sm} 720w, ${sources.md} 1280w, ${sources.lg} 1800w`}
        sizes="100vw"
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority="low"
        onDragStart={(event) => event.preventDefault()}
        onError={() => {
          if (slot === 1) setSlot(0);
          else setFailed(true);
        }}
      />
      <span className="rv-dossier-backdrop__veil" />
    </div>
  );
}
''', encoding="utf-8")

Path("app/roavio/city-hero.css").write_text(r'''/* City dossier photo composition:
   photo #2 = fixed viewport wallpaper, photo #1 = crisp hero image. */
.rv-dossier-page{
  position:relative;
  isolation:isolate;
  min-height:100svh;
  background:#07110e!important;
}
.rv-dossier-page>:not(.rv-dossier-backdrop){position:relative;z-index:1}

.rv-dossier-backdrop{
  position:fixed;
  inset:0;
  z-index:0;
  overflow:hidden;
  pointer-events:none;
  background:linear-gradient(145deg,#102a22,#07110e 62%);
}
.rv-dossier-backdrop img{
  position:absolute;
  inset:-3rem;
  width:calc(100% + 6rem);
  height:calc(100% + 6rem);
  max-width:none;
  object-fit:cover;
  object-position:center;
  filter:blur(22px) saturate(.92) brightness(.46);
  transform:scale(1.035);
  opacity:.78;
  user-select:none;
  -webkit-user-drag:none;
}
.rv-dossier-backdrop__veil{
  position:absolute;
  inset:0;
  background:linear-gradient(180deg,rgba(3,13,10,.40),rgba(3,13,10,.62));
}
.rv-dossier-backdrop--fallback{background:linear-gradient(145deg,#15372c,#07110e 68%)}

html[data-rv-theme='light'] .rv-dossier-page{background:#f5f4ee!important}
html[data-rv-theme='light'] .rv-dossier-backdrop img{
  filter:blur(20px) saturate(.82) brightness(.92);
  opacity:.46;
}
html[data-rv-theme='light'] .rv-dossier-backdrop__veil{
  background:linear-gradient(180deg,rgba(245,244,238,.48),rgba(245,244,238,.68));
}
html[data-rv-theme='light'] .rv-dossier-backdrop--fallback{background:linear-gradient(145deg,#dae6dd,#f5f4ee 70%)}

.rv-dossier-intro{
  position:relative;
  background:transparent!important;
  border-bottom:1px solid rgba(231,255,243,.10);
}
.rv-dossier-intro>div{position:relative}

/* Photo #1 owns the entire hero surface; copy floats above it. */
.rv-dossier-hero{
  position:relative!important;
  display:flex!important;
  align-items:flex-end!important;
  min-height:290px!important;
  background:#07110e!important;
  border-color:rgba(232,255,244,.18)!important;
  box-shadow:0 18px 54px rgba(0,0,0,.24)!important;
  overflow:hidden!important;
  isolation:isolate;
}
.rv-dossier-hero::after{
  content:'';
  position:absolute;
  inset:0;
  z-index:1;
  background:linear-gradient(90deg,rgba(2,13,10,.82) 0%,rgba(2,13,10,.60) 42%,rgba(2,13,10,.18) 72%,rgba(2,13,10,.08) 100%);
  pointer-events:none;
}
.rv-dossier-hero__copy{
  position:relative!important;
  z-index:2!important;
  align-self:flex-end;
  width:min(760px,72%);
  max-width:760px;
}
.rv-dossier-hero__image{
  position:absolute!important;
  inset:0!important;
  z-index:0!important;
  min-width:0;
}
.rv-dossier-hero__image .rv-city-thumb,
.rv-dossier-hero__image .e-img-wrap{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  aspect-ratio:auto!important;
  border-radius:0!important;
}
.rv-dossier-hero__image img{
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  object-position:center!important;
  user-select:none!important;
  -webkit-user-drag:none!important;
}

.rv-dossier-intro .rv-dossier-metric{
  background:rgba(8,29,23,.90)!important;
  border-color:rgba(232,255,244,.14)!important;
  color:#f3faf6!important;
}
.rv-dossier-intro .rv-dossier-metric>*{color:inherit!important}
.rv-dossier-intro .rv-dossier-metric>*:first-child{color:rgba(237,249,243,.72)!important}
.rv-dossier-page .rv-dossier-section,
.rv-dossier-page .rv-dossier-insight,
.rv-dossier-page .rv-dossier-summary{
  background:color-mix(in srgb,var(--rv-card) 92%,transparent)!important;
  backdrop-filter:none!important;
}

@media(max-width:700px){
  .rv-dossier-backdrop img{
    inset:-2rem;
    width:calc(100% + 4rem);
    height:calc(100% + 4rem);
    filter:blur(15px) saturate(.9) brightness(.44);
    transform:scale(1.025);
  }
  html[data-rv-theme='light'] .rv-dossier-backdrop img{filter:blur(14px) saturate(.8) brightness(.94)}
  .rv-dossier-hero{min-height:250px!important}
  .rv-dossier-hero__copy{width:100%;max-width:none;padding:1.15rem!important}
  .rv-dossier-hero::after{background:linear-gradient(180deg,rgba(2,13,10,.16),rgba(2,13,10,.78) 78%,rgba(2,13,10,.88))}
}
''', encoding="utf-8")

print("patched city dossier composition")
