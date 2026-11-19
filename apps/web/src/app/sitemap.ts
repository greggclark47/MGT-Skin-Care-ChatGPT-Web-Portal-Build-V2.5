import type {MetadataRoute} from 'next';

const routes=['','/skin-match','/complexion','/anti-aging','/routine','/coach','/my-skin','/replenishment','/studio','/wardrobe','/shop','/learn','/company','/trust','/ai-disclosure','/privacy','/terms','/shipping','/partners','/membership','/support'];

export default function sitemap():MetadataRoute.Sitemap{
 const modified=new Date();
 return routes.map(path=>({url:`https://team47studio.com${path}`,lastModified:modified,changeFrequency:path===''?'weekly':'monthly',priority:path===''?1:.7}));
}
