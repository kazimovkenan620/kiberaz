interface Props {
  title: string;
}

interface ArtworkSource {
  src: string;
  alt: string;
}

const ARTWORK_ROOT = '/category-artwork';

function artworkSource(title: string): ArtworkSource {
  const value = title.toLocaleLowerCase('az-AZ');

  if (value.includes('network')) {
    return { src: `${ARTWORK_ROOT}/network-security.jpg`, alt: 'Network Security & Attacks — hücum xətləri ilə şəbəkə qlobusu' };
  }
  if (value.includes('web')) {
    return { src: `${ARTWORK_ROOT}/web-security.jpg`, alt: 'Web Security — kilidli veb tətbiq və hücum göstəriciləri' };
  }
  if (value.includes('active directory')) {
    return { src: `${ARTWORK_ROOT}/active-directory.jpg`, alt: 'Active Directory — qorunan server və identifikasiya iyerarxiyası' };
  }
  if (value === 'soc' || value.includes('security operations')) {
    return { src: `${ARTWORK_ROOT}/soc.jpg`, alt: 'SOC — qlobal təhlükələri izləyən təhlükəsizlik əməliyyatları mərkəzi' };
  }
  if (value.includes('code review')) {
    return { src: `${ARTWORK_ROOT}/code-review.jpg`, alt: 'Code Review — mənbə kodunda təhlükəsizlik boşluğunun analizi' };
  }
  if (value.includes('müsahibə')) {
    return { src: `${ARTWORK_ROOT}/interview-questions.jpg`, alt: 'Müsahibə sualları — kiber mütəxəssis üçün texniki müsahibə səhnəsi' };
  }

  return { src: `${ARTWORK_ROOT}/general-cybersecurity.jpg`, alt: 'Ümumi kibertəhlükəsizlik — qlobusu qoruyan rəqəmsal qalxan' };
}

export default function CategoryArtwork({ title }: Props) {
  const artwork = artworkSource(title);

  return (
    <figure className="category-art">
      <img src={artwork.src} alt={artwork.alt} loading="lazy" decoding="async" />
    </figure>
  );
}
