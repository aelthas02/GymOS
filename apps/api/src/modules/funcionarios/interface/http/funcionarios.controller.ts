import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import {
  Autenticado,
  RequirePermission,
  SessaoAtual,
} from '../../../autenticacao/interface/http/decoradores';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import {
  type ResultadoDaCriacao,
  Funcionarios,
  LIMITE_PADRAO_DA_LISTA,
} from '../../application/funcionarios';
import type { Funcionario } from '../../application/portas';
import {
  ConsultaDeFuncionariosDto,
  ConsultaDeProfissionaisDto,
  ConvidarEquipeDto,
  ConviteEmLoteDto,
  CustoDaEquipeDto,
  DadosDoFuncionarioDto,
  FuncionarioDto,
  PaginaDeFuncionariosDto,
  ProfissionalDto,
} from './dto';
import { ErrosDosFuncionariosFilter } from './erros.filter';
import { funcionarioDto } from './mapeamento';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });
const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('funcionarios')
@UseFilters(ErrosDosFuncionariosFilter)
@Controller('funcionarios')
export class FuncionariosController {
  constructor(
    private readonly funcionarios: Funcionarios,
    private readonly contexto: ContextoDoTenant,
  ) {}

  @Get()
  @RequirePermission('equipe:ver')
  @ApiOperation({
    operationId: 'listarFuncionarios',
    summary: 'Lista a equipe, com filtro por cargo, busca por nome e os contadores dos chips.',
  })
  @ApiOkResponse({ type: PaginaDeFuncionariosDto })
  async listar(@Query() consulta: ConsultaDeFuncionariosDto): Promise<PaginaDeFuncionariosDto> {
    const pagina = await this.funcionarios.listar(consulta);
    const tipos = await this.funcionarios.tiposDeAcesso(pagina.itens);
    return {
      itens: pagina.itens.map((item) => funcionarioDto(item, tipos)),
      total: pagina.total,
      pagina: consulta.pagina ?? 1,
      limite: consulta.limite ?? LIMITE_PADRAO_DA_LISTA,
      contadores: pagina.contadores,
    };
  }

  @Get('custos')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'custoDaEquipe',
    summary: 'Custo mensal por funcionário ativo, com a folha do mês e a média (Financeiro, T21).',
  })
  @ApiOkResponse({ type: CustoDaEquipeDto })
  custos(): Promise<CustoDaEquipeDto> {
    return this.funcionarios.custoDaEquipe();
  }

  @Get('profissionais')
  @Autenticado('staff')
  @ApiOperation({
    operationId: 'listarProfissionais',
    summary:
      'Professores e nutricionistas ativos (ou um cargo), para escolher em aulas e na Saúde (T28, T30).',
  })
  @ApiOkResponse({ type: [ProfissionalDto] })
  profissionais(@Query() consulta: ConsultaDeProfissionaisDto): Promise<ProfissionalDto[]> {
    return this.funcionarios.profissionais(consulta.cargo ? [consulta.cargo] : undefined);
  }

  @Post('convites')
  @RequirePermission('equipe:criar')
  @ApiOperation({
    operationId: 'convidarEquipe',
    summary:
      'Passo 3 do onboarding: cadastra cada pessoa e convida quem tem acesso. Idempotente por e-mail: reenviar não duplica nem convida de novo.',
  })
  @ApiCreatedResponse({ type: ConviteEmLoteDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos ou e-mail ausente.' })
  @ApiConflictResponse({ description: 'O e-mail já tem um acesso ao sistema fora da equipe.' })
  async convidar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ConvidarEquipeDto,
  ): Promise<ConviteEmLoteDto> {
    const resultados: ResultadoDaCriacao[] = [];
    for (const pessoa of corpo.pessoas) {
      resultados.push(
        await this.funcionarios.criarSeNaoExistir(this.contexto.tenant(), executor(sessao), pessoa),
      );
    }
    const tipos = await this.funcionarios.tiposDeAcesso(resultados.map((r) => r.funcionario));
    return {
      itens: resultados.map((r) => ({
        funcionario: funcionarioDto(r.funcionario, tipos),
        criado: r.criado,
      })),
    };
  }

  @Get(':id')
  @RequirePermission('equipe:ver')
  @ApiOperation({ operationId: 'buscarFuncionario', summary: 'Um funcionário.' })
  @ApiOkResponse({ type: FuncionarioDto })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  async buscar(@Param('id', uuid) id: string): Promise<FuncionarioDto> {
    return this.comTipo(await this.funcionarios.buscar(id));
  }

  @Post()
  @RequirePermission('equipe:criar')
  @ApiOperation({
    operationId: 'cadastrarFuncionario',
    summary:
      'Cadastra o funcionário. Com tipo de acesso, cria o usuário e envia o convite; sem acesso, só o cadastro.',
  })
  @ApiCreatedResponse({ type: FuncionarioDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos (acesso sem e-mail, cargo, custo).' })
  @ApiConflictResponse({ description: 'E-mail já usado por outro funcionário ou acesso.' })
  async cadastrar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: DadosDoFuncionarioDto,
  ): Promise<FuncionarioDto> {
    return this.comTipo(
      await this.funcionarios.criar(this.contexto.tenant(), executor(sessao), corpo),
    );
  }

  @Put(':id')
  @RequirePermission('equipe:editar')
  @ApiOperation({
    operationId: 'editarFuncionario',
    summary:
      'Edita o funcionário. Sem acesso → com acesso convida; com acesso → sem acesso desativa o usuário.',
  })
  @ApiOkResponse({ type: FuncionarioDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  @ApiConflictResponse({ description: 'E-mail já usado por outro funcionário ou acesso.' })
  async editar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: DadosDoFuncionarioDto,
  ): Promise<FuncionarioDto> {
    return this.comTipo(
      await this.funcionarios.editar(this.contexto.tenant(), executor(sessao), id, corpo),
    );
  }

  @Post(':id/inativar')
  @HttpCode(200)
  @RequirePermission('equipe:editar')
  @ApiOperation({
    operationId: 'inativarFuncionario',
    summary: 'Inativa o funcionário e desativa o login dele, se houver.',
  })
  @ApiOkResponse({ type: FuncionarioDto })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  async inativar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<FuncionarioDto> {
    return this.comTipo(
      await this.funcionarios.inativar(this.contexto.tenant(), executor(sessao), id),
    );
  }

  @Post(':id/reativar')
  @HttpCode(200)
  @RequirePermission('equipe:editar')
  @ApiOperation({
    operationId: 'reativarFuncionario',
    summary: 'Reativa o funcionário e religa o login dele, se tinha acesso.',
  })
  @ApiOkResponse({ type: FuncionarioDto })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  async reativar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<FuncionarioDto> {
    return this.comTipo(
      await this.funcionarios.reativar(this.contexto.tenant(), executor(sessao), id),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('equipe:excluir')
  @ApiOperation({
    operationId: 'excluirFuncionario',
    summary: 'Exclui o funcionário. Com vínculos (alunos, aulas), recusa: inative.',
  })
  @ApiNoContentResponse({ description: 'Excluído.' })
  @ApiNotFoundResponse({ description: 'Funcionário não encontrado.' })
  @ApiConflictResponse({ description: 'Tem vínculos; inative em vez de excluir.' })
  async excluir(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.funcionarios.excluir(executor(sessao), id);
  }

  private async comTipo(funcionario: Funcionario): Promise<FuncionarioDto> {
    return funcionarioDto(funcionario, await this.funcionarios.tiposDeAcesso([funcionario]));
  }
}
