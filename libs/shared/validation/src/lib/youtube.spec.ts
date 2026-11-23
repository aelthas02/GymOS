import { extrairIdYoutube, validarUrlYoutube } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('extrairIdYoutube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?t=42`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtu.be/${ID}`,
    ` https://youtu.be/${ID} `,
  ])('%s → id do vídeo', (url) => {
    expect(extrairIdYoutube(url)).toBe(ID);
  });

  it.each([
    'https://vimeo.com/123456',
    'https://www.youtube.com/watch?v=curto',
    `https://www.youtube.com/watch?x=${ID}`,
    'https://www.youtube.com/',
    'https://youtu.be/',
    `https://youtube.com.exemplo.com/watch?v=${ID}`,
    `https://www.youtube.com/channel/${ID}`,
    `ftp://youtube.com/watch?v=${ID}`,
    'não é url',
    '',
  ])('%j não é vídeo do YouTube', (url) => {
    expect(extrairIdYoutube(url)).toBeNull();
  });
});

describe('validarUrlYoutube', () => {
  it('é verdadeiro só quando há id de vídeo', () => {
    expect(validarUrlYoutube(`https://youtu.be/${ID}`)).toBe(true);
    expect(validarUrlYoutube('https://vimeo.com/123456')).toBe(false);
  });
});
