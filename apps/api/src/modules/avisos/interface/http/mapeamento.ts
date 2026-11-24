import type { Aviso } from '../../application/portas';
import type { AvisoDto } from './dto';

export const avisoDto = (aviso: Aviso): AvisoDto => ({
  id: aviso.id,
  tipo: aviso.tipo,
  titulo: aviso.titulo,
  texto: aviso.texto,
  link: aviso.link,
  lido: aviso.lidoEm !== null,
  criadoEm: aviso.criadoEm.toISOString(),
});
