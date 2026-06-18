import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { articles } from "./data";
import { ChevronRight, ArrowLeft } from "lucide-react";

export default function ArticlesList({ lang = "ru" }) {
  const isEn = lang === "en";

  // Filter articles based on language (default to "ru" if not specified on the article)
  const filteredArticles = articles.filter(a => (a.language || "ru") === lang);

  const t = {
    title: isEn ? "Knowledge Base for Immigration to South Korea | HiKorea Forms" : "Полезные статьи об иммиграции в Южную Корею | HiKorea Forms",
    desc: isEn ? "Instructions, guides, and useful articles on visa extension, getting an ID card, and working with HiKorea." : "Инструкции, гайды и полезные статьи о продлении визы, получении ID-карты и работе с порталом HiKorea.",
    ogTitle: isEn ? "Articles on Immigration to South Korea | HiKorea Forms" : "Статьи об иммиграции в Южную Корею | HiKorea Forms",
    ogDesc: isEn ? "Guides and instructions on visas and ID cards in Korea." : "Инструкции и гайды по визам и ID-картам в Корее.",
    createForm: isEn ? "Create Form" : "Создать форму",
    header: isEn ? "Knowledge Base" : "База знаний",
    subHeader: isEn ? "Useful guides on immigration issues in South Korea" : "Полезные инструкции по иммиграционным вопросам в Южной Корее",
    readMore: isEn ? "Read more" : "Читать далее",
    dateFormat: isEn ? "en-US" : "ru-RU",
    urlPrefix: isEn ? "/en/articles" : "/articles"
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <Helmet>
        <title>{t.title}</title>
        <meta name="description" content={t.desc} />
        <link rel="canonical" href={`https://seo.hikoreaforms.com${t.urlPrefix}`} />
        <meta property="og:title" content={t.ogTitle} />
        <meta property="og:description" content={t.ogDesc} />
        
        {/* Hreflang Tags */}
        <link rel="alternate" hrefLang="ru" href="https://seo.hikoreaforms.com/articles" />
        <link rel="alternate" hrefLang="en" href="https://seo.hikoreaforms.com/en/articles" />
        <link rel="alternate" hrefLang="x-default" href="https://seo.hikoreaforms.com/articles" />
      </Helmet>

      {/* Header */}
      <header className="w-full bg-white shadow-sm py-3 px-4 fixed top-0 z-10 flex items-center justify-between max-w-md">
        <div className="flex items-center">
          <Link 
            to="/"
            className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-full"
          >
            <ArrowLeft size={24} />
          </Link>
          <span className="ml-1 font-semibold text-gray-900">
            HiKorea Forms
          </span>
        </div>
        <Link to="/" className="text-[13px] font-bold bg-blue-50 border border-blue-100 text-blue-600 px-3 py-1.5 rounded-full active:bg-blue-100 transition-colors">
          {t.createForm}
        </Link>
      </header>

      <main className="w-full max-w-md mt-16 p-4 pb-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.header}</h1>
        <p className="text-gray-600 mb-6 text-sm">{t.subHeader}</p>

        <div className="flex flex-col gap-4">
          {filteredArticles.map((article) => (
            <Link
              key={article.slug}
              to={`${t.urlPrefix}/${article.slug}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <div className="text-xs font-medium text-blue-500 uppercase tracking-wider">
                {new Date(article.date).toLocaleDateString(t.dateFormat, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {article.title}
              </h2>
              <p className="text-gray-600 text-sm line-clamp-3">
                {article.excerpt}
              </p>
              <div className="flex items-center text-blue-600 font-semibold text-sm mt-1">
                {t.readMore} <ChevronRight size={16} className="ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
