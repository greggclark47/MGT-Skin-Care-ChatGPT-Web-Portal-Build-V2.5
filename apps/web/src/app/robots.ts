import type {MetadataRoute} from 'next';

export default function robots():MetadataRoute.Robots{
 return {rules:{userAgent:'*',allow:'/',disallow:['/admin/']},sitemap:'https://team47studio.com/sitemap.xml',host:'https://team47studio.com'};
}
