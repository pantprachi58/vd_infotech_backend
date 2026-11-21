// Content for /blogs, /blogs/[category] and /blogs/[category]/[slug]. Copy
// changes belong here (and in blogContent.json), not in the components.
// `src/lib/blog.js` is the only module that imports this file; the article
// bodies in blogContent.json are imported only by `src/lib/blogPost.js`, so
// they never reach the client bundles that pull in site.js.
//
// `readMinutes` is the body's word count / 200, rounded — kept here so the
// listings need not load the bodies.
//
// Every post was imported from the VD Infotech WordPress blog
// (https://hrms.vdinfotech.cloud/blog/): title, publish date and excerpt as
// published there, the featured image as a local WebP in /public/images/blog,
// and the article body in blogContent.json — converted to plain blocks
// (paragraphs, headings, lists, bold) so it renders without raw HTML. Links in
// the bodies that pointed at the WordPress host's own service pages became
// plain text; a link to another imported post is stored as { post: slug }.
//
// `category` files each post under one of the seven topics in the Company >
// Blog menu. The WordPress blog uses different categories, so this mapping is
// ours — change it here and every page and URL follows.

export const BLOG_AUTHOR = "VD Infotech";

// The three categories the /blogs page gives a column each, under the slider.
export const featuredBlogCategories = ["digital-marketing", "development", "branding"];

export const blogCategories = [
  {
    slug: "digital-marketing",
    name: "Digital Marketing",
    tagline: "SEO, local search, social media and the strategies that bring businesses measurable online growth.",
  },
  {
    slug: "branding",
    name: "Branding",
    tagline: "Influencer marketing, social media design and sponsored content that make brands recognisable and trusted.",
  },
  {
    slug: "google-and-meta-ads",
    name: "Google and Meta Ads",
    tagline: "Paid campaigns that turn ad spend into leads and sales — strategy, case studies and results.",
  },
  {
    slug: "development",
    name: "Development",
    tagline: "Website design and development insights for building fast, responsive sites that convert.",
  },
  {
    slug: "ai-and-automation",
    name: "AI & Automation",
    tagline: "Automated marketing, messaging and workflows that save time and keep customers engaged.",
  },
  {
    slug: "business-growth",
    name: "Business Growth",
    tagline: "Lead generation, sales support and virtual assistance that help businesses scale efficiently.",
  },
  {
    slug: "technology",
    name: "Technology",
    tagline: "Software, platforms and technology choices explained for growing Indian businesses.",
  },
];

// Newest first, as on the WordPress blog.
export const blogPosts = [
  {
    slug: "top-software-development-services-vd-infotech",
    title: "Top Software Development Services | VD Infotech",
    category: "technology",
    date: "2025-08-06",
    readMinutes: 3,
    image: "/images/blog/top-software-development-services-vd-infotech.webp",
    excerpt: "Get custom software development services from VD Infotech—experts in mobile, cloud, SaaS & enterprise software solutions.",
    // Longer copy for the featured card on the home page, which has room for it.
    summary: [
      "Get custom software development services from VD Infotech—experts in mobile, cloud, SaaS & enterprise software solutions.",
      "Off-the-shelf software rarely fits the way a growing business actually works. We build custom, enterprise, mobile and cloud software from the ground up around your workflows—handling everything from ideation and design to deployment and long-term support, so your technology scales as fast as you do.",
    ],
  },
  {
    slug: "professional-website-design-services-vd-infotech",
    title: "Professional Website Design Services | VD Infotech",
    category: "development",
    date: "2025-08-04",
    readMinutes: 2,
    image: "/images/blog/professional-website-design-services-vd-infotech.webp",
    excerpt: "VD Infotech offers custom, responsive, and SEO-friendly website design solutions including e-commerce, WordPress, and UI/UX services.",
  },
  {
    slug: "custom-affordable-website-design-services-vd-infotech",
    title: "Custom & Affordable Website Design Services | VD Infotech",
    category: "development",
    date: "2025-07-30",
    readMinutes: 3,
    image: "/images/blog/custom-affordable-website-design-services-vd-infotech.webp",
    excerpt: "VD Infotech offers expert website design services, including e-commerce, WordPress, responsive & mobile-friendly designs for all businesses.",
  },
  {
    slug: "professional-seo-services-by-vd-infotech",
    title: "Professional SEO Services by VD Infotech",
    category: "digital-marketing",
    date: "2025-07-29",
    readMinutes: 2,
    image: "/images/blog/professional-seo-services-by-vd-infotech.webp",
    excerpt: "Boost your online presence with expert SEO services by VD Infotech. We offer local, technical, on-page, and affordable SEO for all businesses.",
  },
  {
    slug: "whatsapp-marketing-services-by-vd-infotech",
    title: "WhatsApp Marketing Services by VD Infotech",
    category: "ai-and-automation",
    date: "2025-07-28",
    readMinutes: 3,
    image: "/images/blog/whatsapp-marketing-services-by-vd-infotech.webp",
    excerpt: "VD Infotech offers professional WhatsApp Marketing Services including bulk messaging, automation tools, lead generation, and campaign strategies for small businesses and e-commerce brands.",
  },
  {
    slug: "best-influencer-marketing-services-in-india-vd-infotech",
    title: "Best Influencer Marketing Services in India | VD Infotech",
    category: "branding",
    date: "2025-07-25",
    readMinutes: 3,
    image: "/images/blog/best-influencer-marketing-services-in-india-vd-infotech.webp",
    excerpt: "Boost your brand with professional influencer marketing services by VD Infotech. Collaborate with top social media influencers and grow ROI-driven results.",
  },
  {
    slug: "boost-your-sales-with-expert-sales-support-services-vd-infotech",
    title: "Boost Your Sales with Expert Sales Support Services | VD Infotech",
    category: "business-growth",
    date: "2025-07-21",
    readMinutes: 3,
    image: "/images/blog/boost-your-sales-with-expert-sales-support-services-vd-infotech.webp",
    excerpt: "Discover how VD Infotech’s professional sales support services help businesses increase conversions, streamline processes, and empower sales teams with data-driven solutions.",
  },
  {
    slug: "social-media-designing-services-custom-graphics-by-vd-infotech",
    title: "Social Media Designing Services | Custom Graphics by VD Infotech",
    category: "branding",
    date: "2025-07-16",
    readMinutes: 4,
    image: "/images/blog/social-media-designing-services-custom-graphics-by-vd-infotech.webp",
    excerpt: "Boost your brand’s online presence with expert social media designing services from VD Infotech.",
  },
  {
    slug: "professional-website-development-services-by-vd-infotech-best-website-development-company",
    title: "Professional Website Development Services by VD Infotech | Best Website Development Company",
    category: "development",
    date: "2025-07-15",
    readMinutes: 4,
    image: "/images/blog/professional-website-development-services-by-vd-infotech-best-website-development-company.webp",
    excerpt: "Discover top website development services by VD Infotech. From custom, responsive, and e-commerce website development to full stack solutions – we build websites that grow your business.",
  },
  {
    slug: "sponsored-content-services-by-vd-infotech-boost-brand-visibility-online",
    title: "Sponsored Content Services by VD Infotech | Boost Brand Visibility Online",
    category: "branding",
    date: "2025-07-14",
    readMinutes: 4,
    image: "/images/blog/sponsored-content-services-by-vd-infotech-boost-brand-visibility-online.webp",
    excerpt: "Explore the benefits of sponsored content with VD Infotech – a leading digital marketing agency helping brands boost visibility, and ROI through strategic content placements.",
  },
  {
    slug: "whatsapp-marketing-services-by-vd-infotech-trusted-affordable-solutions",
    title: "WhatsApp Marketing Services by VD Infotech – Trusted & Affordable Solutions",
    category: "ai-and-automation",
    date: "2025-07-11",
    readMinutes: 4,
    image: "/images/blog/whatsapp-marketing-services-by-vd-infotech-trusted-affordable-solutions.webp",
    excerpt: "Explore affordable, automated WhatsApp marketing services by VD Infotech.",
  },
  {
    slug: "award-winning-seo-company-vd-infotech-best-seo-services-in-india",
    title: "Award-Winning SEO Company – VD Infotech | Best SEO Services in India",
    category: "digital-marketing",
    date: "2025-07-10",
    readMinutes: 4,
    image: "/images/blog/award-winning-seo-company-vd-infotech-best-seo-services-in-india.webp",
    excerpt: "Discover VD Infotech, an award-winning SEO company trusted by brands across industries.",
  },
  {
    slug: "boost-your-business-with-google-business-listing-vd-infotech",
    title: "Boost Your Business with Google Business Listing – VD Infotech",
    category: "digital-marketing",
    date: "2025-07-09",
    readMinutes: 4,
    image: "/images/blog/boost-your-business-with-google-business-listing-vd-infotech.webp",
    excerpt: "Get professional Google My Business listing services, profile optimization, and local SEO to grow your brand visibility.",
  },
  {
    slug: "best-seo-tips-for-local-businesses-in-delhi-ncr",
    title: "Best SEO Tips for Local Businesses in Delhi NCR",
    category: "digital-marketing",
    date: "2025-07-08",
    readMinutes: 3,
    image: "/images/image-of-digital-mrketing.webp",
    excerpt: "In a competitive region like Delhi NCR, local businesses can’t rely solely on foot traffic and traditional marketing to grow.",
  },
  {
    slug: "300-growth-with-google-ads-vd-infotech-client-success",
    title: "300% Growth with Google Ads | VD Infotech Client Success",
    category: "google-and-meta-ads",
    date: "2025-07-08",
    readMinutes: 4,
    image: "/images/blog/300-growth-with-google-ads-vd-infotech-client-success.webp",
    excerpt: "Discover how VD Infotech helped a new client achieve 300% business growth through strategic Google Ads campaigns.",
  },
  {
    slug: "seo-company-for-real-estate-delhi-ncr-vd-infotech",
    title: "SEO Company for Real Estate Delhi NCR – VD Infotech",
    category: "digital-marketing",
    date: "2025-07-07",
    readMinutes: 2,
    image: "/images/blog/seo-company-for-real-estate-delhi-ncr-vd-infotech.webp",
    excerpt: "Boost your property business with VD Infotech, the top SEO company for real estate in Delhi NCR.",
  },
  {
    slug: "how-seo-boosts-real-estate-lead-generation",
    title: "How SEO Boosts Real Estate Lead Generation",
    category: "business-growth",
    date: "2025-06-27",
    readMinutes: 3,
    image: "/images/blog/how-seo-boosts-real-estate-lead-generation.webp",
    excerpt: "In today’s digitally driven real estate market, simply listing properties online is not enough. To truly stand out and attract qualified buyers or renters, real estate businesses must invest in real estate SEO.",
  },
  {
    slug: "new-client-success-300-growth-via-google-ads",
    title: "New Client Success: 300% Growth via Google Ads",
    category: "google-and-meta-ads",
    date: "2025-06-27",
    readMinutes: 2,
    image: "/images/blog/new-client-success-300-growth-via-google-ads.webp",
    excerpt: "In the competitive world of digital marketing, achieving consistent growth through paid advertising is a true testament to strategy, execution, and experience.",
  },
  {
    slug: "custom-website-vs-template-whats-best-in-2025",
    title: "Custom Website vs Template: What’s Best in 2025?",
    category: "development",
    date: "2025-06-26",
    readMinutes: 1,
    image: "/images/blog/custom-website-vs-template-whats-best-in-2025.webp",
    excerpt: "In today’s digital-first world, your website is more than just a digital address—it's your brand's identity.",
  },
  {
    slug: "wordpress-vs-shopify-for-indian-businesses",
    title: "WordPress vs Shopify for Indian Businesses",
    category: "technology",
    date: "2025-06-26",
    readMinutes: 2,
    image: "/images/blog/wordpress-vs-shopify-for-indian-businesses.webp",
    excerpt: "In the booming world of online business, choosing the right platform is crucial for success. When it comes to setting up an eCommerce store, the two giants—WordPress and Shopify—dominate the Indian market.",
  },
  {
    slug: "top-10-benefits-of-seo-for-indian-businesses-insights-by-vd-infotech",
    title: "Top 10 Benefits of SEO for Indian Businesses – Insights by VD Infotech",
    category: "digital-marketing",
    date: "2025-06-25",
    readMinutes: 3,
    image: "/images/blog/top-10-benefits-of-seo-for-indian-businesses-insights-by-vd-infotech.webp",
    excerpt: "In the ever-evolving digital economy, Indian businesses are rapidly shifting online—and those that want to be seen must play by one critical rule: visibility is everything.",
  },
  {
    slug: "what-is-digital-marketing-why-it-matters-in-2025",
    title: "What is Digital Marketing & Why It Matters in 2025",
    category: "digital-marketing",
    date: "2025-06-25",
    readMinutes: 2,
    image: "/images/blog/what-is-digital-marketing-why-it-matters-in-2025.webp",
    excerpt: "In today’s fast-paced digital age, businesses are no longer relying solely on traditional marketing methods like print ads, flyers, or word-of-mouth.",
  },
  {
    slug: "micro-influencer-marketing-will-replace-celebrity-endorsements-in-2025",
    title: "Micro-Influencer Marketing Will Replace Celebrity Endorsements in 2025",
    category: "branding",
    date: "2025-06-05",
    readMinutes: 5,
    image: "/images/blog/micro-influencer-marketing-will-replace-celebrity-endorsements-in-2025.webp",
    excerpt: "The digital marketing world is witnessing a dramatic shift. Where once big-name celebrities and social media stars dominated the influencer landscape, 2025 is ushering in a new era — one where micro-influencers reign supreme.",
  },
  {
    slug: "why-your-business-needs-a-virtual-assistant-in-2025",
    title: "Why Your Business Needs a Virtual Assistant in 2025",
    category: "business-growth",
    date: "2025-06-05",
    readMinutes: 4,
    image: "/images/blog/why-your-business-needs-a-virtual-assistant-in-2025.webp",
    excerpt: "In the fast-paced digital age, managing a business has become more complex than ever.",
  },
  {
    slug: "the-future-of-digital-marketing-in-2025-trends-you-cant-ignore",
    title: "The Future of Digital Marketing in 2025: Trends You Can’t Ignore",
    category: "digital-marketing",
    date: "2025-06-05",
    readMinutes: 4,
    image: "/images/blog/the-future-of-digital-marketing-in-2025-trends-you-cant-ignore.webp",
    excerpt: "The world of digital marketing is undergoing a massive transformation. In just the past few years, we’ve seen the rise of AI, the dominance of short-form video, and a new era of personalized, data-driven strategies.",
  },
];
