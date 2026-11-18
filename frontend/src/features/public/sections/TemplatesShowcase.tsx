import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import type { SiteInfo } from "@/api/types";
import { warmPreview } from "@/features/invite/previewPrefetch";
import { useHistoryState } from "@/lib/useHistoryState";
import { pick, useLang } from "../text";
import type { ComposeTemplate, PublicTemplate } from "../types";

/**
 * عرض القوالب في الرئيسية (لما الأدمن يختار «تلفون بيشغّل القالب»):
 * تلفون بيشغّل معاينة القالب الحقيقية نفسها (iframe متصغّر من ‎390×720‎ — مقاس المتصفح
 * على التلفون بعد شريط العنوان، فكل قسم بيملا الشاشة زي ما الضيف بيشوفه)،
 * وجنبه اسم القالب وأزراره وكروت كل القوالب للاختيار.
 * القوالب: كلها دايمًا — اللي الأدمن رتّبها (‎compose‎) الأول، والباقي بعدها بترتيب المعرض.
 */

const PHONE_W = 390;
const PHONE_H = 720;
/** أزرار المعاينة اللي بتخرّج برّه (رجوع، نسخ الرابط، شريط التواصل، التمرير التلقائي) بتستخبى جوه التلفون بس */
const HIDE_IN_PHONE =
  ".lb-back,.lb-share-fab,.lb-cta,.lb-autoscroll{display:none!important}" +
  "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}";

const previewPath = (slug: string) => `/templates/${slug}/preview/`;

interface Props {
  site: SiteInfo;
  templates: PublicTemplate[] | undefined;
  chosen: ComposeTemplate[] | undefined;
  error: unknown;
}

export function TemplatesShowcase({ site, templates, chosen, error }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const all = templates ?? [];
  const picked = (chosen ?? [])
    .map((c) => all.find((tpl) => tpl.slug === c.slug))
    .filter(Boolean) as PublicTemplate[];
  // كل القوالب المفعّلة بتظهر دايمًا: اللي الأدمن اختارها الأول بترتيبه، والباقي بعدها بترتيب المعرض
  const list = [...picked, ...all.filter((tpl) => !picked.includes(tpl))];

  // محفوظ في خانة التاريخ: الرجوع من المعاينة الكاملة بيلاقي نفس القالب
  const [stored, setStored] = useHistoryState("showcaseTemplate", "");
  const [near, setNear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(0.7);
  const section = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const rail = useRef<HTMLDivElement>(null);

  const index = Math.max(
    0,
    list.findIndex((tpl) => tpl.slug === stored),
  );
  const current = list[index];

  // المعاينة بتتحمّل بس لما القسم يقرب من الشاشة
  useEffect(() => {
    const el = section.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setNear(true),
      { rootMargin: "500px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, near]);

  // القالب بيترسم على ٣٩٠×٧٢٠ وبيتصغّر على عرض شاشة التلفون
  useEffect(() => {
    const el = screen.current;
    if (!el) return;
    const fit = () => el.clientWidth && setScale(el.clientWidth / PHONE_W);
    fit();
    const ro = "ResizeObserver" in window ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [list.length]);

  // الكارت المختار يفضل باين في الشريط (على التلفون الشريط بيتسحب بالعرض)
  useEffect(() => {
    const box = rail.current;
    const card = box?.querySelector<HTMLElement>(".sc-card.is-active");
    if (!box || !card || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({
      left: card.offsetLeft - (box.clientWidth - card.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [current?.slug]);

  // على التلفون الكروت شريط بيتسحب: بنعرف فيه حاجة مستخبية يمين/شمال عشان الأطراف تبهت
  // والأسهم تظهر، وشريط تقدّم صغير تحته. (حسابات فيزيائية: RTL في كروم scrollLeft بيبقى سالب)
  const [edges, setEdges] = useState({
    left: false,
    right: false,
    thumb: 1,
    at: 0,
  });
  useEffect(() => {
    const box = rail.current;
    if (!box) return;
    const measure = () => {
      const max = box.scrollWidth - box.clientWidth;
      if (max <= 4)
        return setEdges({ left: false, right: false, thumb: 1, at: 0 });
      const rtl = getComputedStyle(box).direction === "rtl";
      const fromStart = Math.min(max, Math.abs(box.scrollLeft));
      const hiddenStart = fromStart > 4;
      const hiddenEnd = fromStart < max - 4;
      setEdges({
        left: rtl ? hiddenEnd : hiddenStart,
        right: rtl ? hiddenStart : hiddenEnd,
        thumb: box.clientWidth / box.scrollWidth,
        at: fromStart / max,
      });
    };
    measure();
    box.addEventListener("scroll", measure, { passive: true });
    const ro = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    return () => {
      box.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [list.length]);

  // أول ما الشريط يبان: يتزق شوية لقدّام ويرجع، عشان الزائر يفهم إنه بيتسحب
  const nudged = useRef(false);
  useEffect(() => {
    const box = rail.current;
    if (
      !near ||
      nudged.current ||
      !box ||
      box.scrollWidth - box.clientWidth <= 4
    )
      return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    nudged.current = true;
    const forward = getComputedStyle(box).direction === "rtl" ? -1 : 1;
    let back = 0;
    const go = window.setTimeout(() => {
      box.scrollBy({ left: forward * 90, behavior: "smooth" });
      back = window.setTimeout(
        () => box.scrollBy({ left: -forward * 90, behavior: "smooth" }),
        650,
      );
    }, 900);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(back);
    };
  }, [near, list.length]);

  const slide = (dir: -1 | 1) => {
    const box = rail.current;
    if (box)
      box.scrollBy({ left: dir * box.clientWidth * 0.75, behavior: "smooth" });
  };

  const failure = !!error && (
    <p className="empty" role="alert">
      {error instanceof ApiError && error.message
        ? error.message
        : t("public.loadError")}
    </p>
  );

  function choose(slug: string) {
    if (slug === current?.slug) return;
    setLoading(true);
    setStored(slug);
  }
  const step = (by: number) =>
    list.length && choose(list[(index + by + list.length) % list.length].slug);

  function onFrameLoad() {
    setLoading(false);
    try {
      const doc = frame.current?.contentDocument;
      if (doc && !doc.getElementById("bahja-phone-hide")) {
        const style = doc.createElement("style");
        style.id = "bahja-phone-hide";
        style.textContent = HIDE_IN_PHONE;
        doc.head.appendChild(style);
      }
    } catch {
      /* نفس الموقع دايمًا — لو حصل أي حاجة المعاينة بتفضل شغّالة بأزرارها */
    }
  }

  const nameOf = (tpl: PublicTemplate) => pick(lang, tpl.name, tpl.nameEn);
  const name = current ? nameOf(current) : "";
  const description = current
    ? pick(lang, current.description, current.descriptionEn)
    : "";
  const orderUrl =
    current && site.whatsapp.base
      ? `${site.whatsapp.base}?text=${encodeURIComponent(t("public.showcase.orderMessage", { name }))}`
      : "";

  return (
    <section className="section section--showcase" id="templates" ref={section}>
      <div className="wrap">
        <div className="section-head" data-reveal>
          <p className="eyebrow">{t("public.showcase.eyebrow")}</p>
          <h2>{t("public.showcase.title")}</h2>
          <p>{t("public.showcase.sub")}</p>
        </div>

        {failure}
        {current && (
          <div className="sc" data-reveal>
            <div className="sc-stage">
              <button
                type="button"
                className="sc-arrow sc-arrow--prev"
                onClick={() => step(-1)}
                aria-label={t("public.showcase.prev")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="sc-phone">
                <div className="sc-island" aria-hidden="true" />
                <div className="sc-screen" ref={screen}>
                  {near && (
                    <iframe
                      key={current.slug}
                      ref={frame}
                      className="sc-frame"
                      src={previewPath(current.slug)}
                      title={name}
                      onLoad={onFrameLoad}
                      style={{
                        width: PHONE_W,
                        height: PHONE_H,
                        transform: `scale(${scale})`,
                      }}
                    />
                  )}
                  <div
                    className={"sc-loading" + (loading ? " is-on" : "")}
                    aria-hidden="true"
                  >
                    {/* الغلاف مربّع: بيظهر كامل في النص فوق نسخة منه مغبّشة مالية الشاشة */}
                    {current.cover && (
                      <img
                        className="sc-loading-bg"
                        src={current.cover}
                        alt=""
                      />
                    )}
                    {current.cover && (
                      <img
                        className="sc-loading-fg"
                        src={current.cover}
                        alt=""
                      />
                    )}
                    <span className="sc-spin" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="sc-arrow sc-arrow--next"
                onClick={() => step(1)}
                aria-label={t("public.showcase.next")}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <p className="sc-tip">{t("public.showcase.tip")}</p>
            </div>

            <div className="sc-panel">
              <div className="sc-info" aria-live="polite">
                <p className="sc-count">
                  {String(index + 1).padStart(2, "0")}{" "}
                  <span>/ {String(list.length).padStart(2, "0")}</span>
                </p>
                <h3 className="sc-name">{name}</h3>
                {current.category !== "none" && current.categoryLabel && (
                  <p className="sc-cat">{current.categoryLabel}</p>
                )}
                {description && <p className="sc-desc">{description}</p>}
                <div className="sc-actions">
                  {orderUrl && (
                    <a
                      className="btn btn--gold"
                      href={orderUrl}
                      target="_blank"
                      rel="noopener"
                    >
                      {t("public.showcase.order")}
                    </a>
                  )}
                  <Link
                    className="btn btn--ghost"
                    to={previewPath(current.slug)}
                    onPointerEnter={() => warmPreview(current.slug)}
                    onFocus={() => warmPreview(current.slug)}
                  >
                    {t("public.showcase.open")}
                  </Link>
                </div>
              </div>

              <div
                className={
                  "sc-rail-wrap" +
                  (edges.left ? " is-left" : "") +
                  (edges.right ? " is-right" : "")
                }
              >
                <div
                  className="sc-rail"
                  ref={rail}
                  role="listbox"
                  aria-label={t("public.showcase.pick")}
                >
                  {list.map((tpl) => {
                    const on = tpl.slug === current.slug;
                    return (
                      <button
                        key={tpl.slug}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={"sc-card" + (on ? " is-active" : "")}
                        onClick={() => choose(tpl.slug)}
                        onPointerEnter={() => warmPreview(tpl.slug)}
                      >
                        <span className="sc-card-img">
                          {tpl.cover ? (
                            <img src={tpl.cover} alt="" loading="lazy" />
                          ) : (
                            <span className="sc-card-ph">
                              {nameOf(tpl).charAt(0)}
                            </span>
                          )}
                          {tpl.isNew && (
                            <span className="sc-new">
                              {t("public.templates.new")}
                            </span>
                          )}
                        </span>
                        <span className="sc-card-name">{nameOf(tpl)}</span>
                      </button>
                    );
                  })}
                </div>
                {edges.thumb < 1 && (
                  <>
                    <button
                      type="button"
                      className="sc-rail-btn sc-rail-btn--left"
                      onClick={() => slide(-1)}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M15 5l-7 7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="sc-rail-btn sc-rail-btn--right"
                      onClick={() => slide(1)}
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="sc-rail-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${edges.thumb * 100}%`,
                          insetInlineStart: `${edges.at * (1 - edges.thumb) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="sc-rail-hint">
                      {t("public.showcase.swipe", { count: list.length })}
                    </p>
                  </>
                )}
              </div>

              <Link className="sc-all" to="/templates">
                {t("public.showcase.all")} <span aria-hidden="true">←</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
