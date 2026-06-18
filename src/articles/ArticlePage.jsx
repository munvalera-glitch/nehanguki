import React, { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { articles } from "./data";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";

export default function ArticlePage({ lang = "ru" }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isEn = lang === "en";

  const t = {
    header: isEn ? "Knowledge Base" : "База знаний",
    notFound: isEn ? "Article not found" : "Статья не найдена",
    backToList: isEn ? "Return to list" : "Вернуться к списку",
    urlPrefix: isEn ? "/en/articles" : "/articles",
    toc: isEn ? "Table of Contents" : "Содержание",
    ctaTitle: isEn ? "Need help with documents?" : "Нужна помощь с документами?",
    ctaText: isEn ? "HiKorea Forms automatically prepares immigration forms based on photos of your passport, ID card, and other documents." : "HiKorea Forms помогает автоматически подготовить иммиграционные формы на основании фотографий паспорта, ID-карты и других документов.",
    ctaBtn: isEn ? "Prepare documents automatically" : "Подготовить документы автоматически",
    related: isEn ? "Related Articles" : "Похожие статьи",
    dateFormat: isEn ? "en-US" : "ru-RU"
  };

  const article = articles.find((a) => a.slug === slug && (a.language || "ru") === lang);
  const relatedArticles = articles
    .filter((a) => a.slug !== slug && (a.language || "ru") === lang)
    .slice(0, 3);

  // Scroll to top on mount or route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.notFound}</h1>
        <button
          onClick={() => navigate(t.urlPrefix)}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full font-medium"
        >
          {t.backToList}
        </button>
      </div>
    );
  }

  // Extract headings for Table of Contents with their original index
  const toc = article.content
    .map((block, idx) => ({ ...block, originalIdx: idx }))
    .filter((block) => block.type === "h2");

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      <Helmet>
        <title>{article.seo.title}</title>
        <meta name="description" content={article.seo.description} />
        <link rel="canonical" href={`https://seo.hikoreaforms.com${t.urlPrefix}/${article.slug}`} />
        <meta property="og:title" content={article.seo.title} />
        <meta property="og:description" content={article.seo.description} />
        <meta property="og:type" content="article" />
        <link rel="alternate" hrefLang={lang} href={`https://seo.hikoreaforms.com${t.urlPrefix}/${article.slug}`} />
        {article.alternateSlug && (
          <link rel="alternate" hrefLang={isEn ? "ru" : "en"} href={`https://seo.hikoreaforms.com${isEn ? '/articles' : '/en/articles'}/${article.alternateSlug}`} />
        )}
      </Helmet>

      {/* Header */}
      <header className="w-full bg-white shadow-sm py-4 px-4 sticky top-0 z-10 flex items-center max-w-md">
        <button 
          onClick={() => navigate(t.urlPrefix)}
          className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"
        >
          <ArrowLeft size={24} />
        </button>
        <span className="ml-2 font-semibold text-gray-900 truncate">
          {t.header}
        </span>
      </header>

      <main className="w-full max-w-md pb-20">
        <article className="p-5">
          {/* Article Header */}
          <div className="mb-8">
            <div className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-3">
              {new Date(article.date).toLocaleDateString(t.dateFormat, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-4">
              {article.title}
            </h1>
            
            {/* Language Switcher */}
            {article.alternateSlug && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  disabled={!isEn && !article.alternateSlug}
                  onClick={() => !isEn ? null : navigate(`/articles/${article.alternateSlug}`)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${!isEn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  RU
                </button>
                <button
                  disabled={isEn && !article.alternateSlug}
                  onClick={() => isEn ? null : navigate(`/en/articles/${article.alternateSlug}`)}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${isEn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  EN
                </button>
              </div>
            )}
          </div>

          {/* Table of Contents */}
          {toc.length > 0 && (
            <div className="bg-blue-50/50 rounded-xl p-5 mb-8 border border-blue-100">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <FileText size={18} className="mr-2 text-blue-600" />
                {t.toc}
              </h3>
              <ul className="space-y-2">
                {toc.map((heading, i) => (
                  <li key={i} className="text-sm font-medium">
                    <a 
                      href={`#heading-${heading.originalIdx}`}
                      className="text-blue-700 hover:text-blue-800 hover:underline transition-colors block py-1"
                    >
                      {i + 1}. {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Article Content */}
          <div className="space-y-6 text-gray-800 leading-relaxed">
            {article.content.map((block, idx) => {
              switch (block.type) {
                case "intro":
                  return (
                    <p key={idx} className="text-lg font-medium text-gray-700">
                      {block.text}
                    </p>
                  );
                case "text":
                  return <p key={idx}>{block.text}</p>;
                case "h2":
                  return (
                    <h2 key={idx} id={`heading-${idx}`} className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-20">
                      {block.text}
                    </h2>
                  );
                case "image":
                  // User requested to hide image placeholders for now
                  return null;
                case "table":
                  return (
                    <div key={idx} className="my-6 overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-semibold">
                          <tr>
                            {block.headers.map((h, i) => (
                              <th key={i} className="px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-gray-800">
                          {block.rows.map((row, r) => (
                            <tr key={r}>
                              {row.map((cell, c) => (
                                <td key={c} className="px-4 py-3">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        </article>

        <hr className="my-8 border-gray-200" />

        {/* CTA Block */}
        <section className="px-5 mb-10">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center shadow-lg">
            <h2 className="text-xl font-bold mb-3">{t.ctaTitle}</h2>
            <p className="text-blue-100 text-sm mb-6 leading-relaxed">
              {t.ctaText}
            </p>
            <a 
              href="/"
              className="block w-full bg-white text-blue-700 font-bold py-4 px-4 rounded-xl shadow-sm active:scale-95 transition-transform"
            >
              {t.ctaBtn}
            </a>
          </div>
        </section>

        {/* Related Articles */}
        <section className="px-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t.related}</h2>
          <div className="flex flex-col gap-3">
            {relatedArticles.map((rel) => (
              <Link
                key={rel.slug}
                to={`${t.urlPrefix}/${rel.slug}`}
                className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between active:bg-gray-100"
              >
                <div className="pr-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1 leading-snug">
                    {rel.title}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {new Date(rel.date).toLocaleDateString(t.dateFormat)}
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
