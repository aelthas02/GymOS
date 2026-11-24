import {
  CampoDeCodigo,
  CampoDeEmail,
  CampoDeSenha,
  MascaraBrl,
  MascaraCep,
  MascaraCnpj,
  MascaraCompetencia,
  MascaraCpf,
  MascaraCpfOuEmail,
  MascaraData,
  MascaraDecimal,
  MascaraHorario,
  MascaraPercentual,
  MascaraTelefone,
  OnlyNumbers,
  Trim,
} from '@gymos/shared-forms';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Field, FieldControl } from '../lib/field/field';

const meta: Meta = {
  title: 'Formulários/Máscaras e diretivas',
  decorators: [
    moduleMetadata({
      imports: [
        Field,
        FieldControl,
        MascaraCpf,
        MascaraCnpj,
        MascaraCpfOuEmail,
        MascaraTelefone,
        MascaraCep,
        MascaraBrl,
        MascaraPercentual,
        MascaraDecimal,
        MascaraData,
        MascaraCompetencia,
        MascaraHorario,
        CampoDeEmail,
        CampoDeSenha,
        CampoDeCodigo,
        OnlyNumbers,
        Trim,
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj;

const estilo =
  'height:44px;padding:0 14px;border:1px solid var(--border);border-radius:12px;font:14px var(--font)';
const grade =
  'display:grid;gap:16px;padding:16px;max-width:880px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))';

/** Todos os campos da tabela "Formulários encontrados" do plano, com a máscara de cada um. */
export const Todos: Story = {
  render: () => ({
    template: `<div style="${grade}">
      <ui-field label="E-mail (painel)"><input uiFieldControl appEmail style="${estilo}" /></ui-field>
      <ui-field label="Senha"><input uiFieldControl appSenha style="${estilo}" /></ui-field>
      <ui-field label="Nova senha"><input uiFieldControl appSenha="nova" style="${estilo}" /></ui-field>
      <ui-field label="CPF ou e-mail (aluno)" hint="Sem teclado numérico: aceita letras"><input uiFieldControl appCpfOuEmail style="${estilo}" /></ui-field>
      <ui-field label="Tenho um código"><input uiFieldControl appCodigo style="${estilo}" /></ui-field>
      <ui-field label="Cor (hex)"><input uiFieldControl appTrim placeholder="#0F8F63" style="${estilo}" /></ui-field>
      <ui-field label="Cor (R / G / B)"><input uiFieldControl appOnlyNumbers inputmode="numeric" style="${estilo}" /></ui-field>
      <ui-field label="Valor total"><input uiFieldControl appBrl style="${estilo}" /></ui-field>
      <ui-field label="Duração (meses)"><input uiFieldControl appOnlyNumbers inputmode="numeric" style="${estilo}" /></ui-field>
      <ui-field label="Telefone"><input uiFieldControl appTelefone style="${estilo}" /></ui-field>
      <ui-field label="CPF (nota fiscal)"><input uiFieldControl appCpf style="${estilo}" /></ui-field>
      <ui-field label="CNPJ (dados fiscais)"><input uiFieldControl appCnpj style="${estilo}" /></ui-field>
      <ui-field label="CEP"><input uiFieldControl appCep style="${estilo}" /></ui-field>
      <ui-field label="Válida até"><input uiFieldControl appData placeholder="dd/mm/aaaa" style="${estilo}" /></ui-field>
      <ui-field label="Competência"><input uiFieldControl appCompetencia placeholder="mm/aaaa" style="${estilo}" /></ui-field>
      <ui-field label="Horário"><input uiFieldControl appHorario placeholder="hh:mm" style="${estilo}" /></ui-field>
      <ui-field label="ISS (%)"><input uiFieldControl appPercent style="${estilo}" /></ui-field>
      <ui-field label="Peso (kg)"><input uiFieldControl appDecimal style="${estilo}" /></ui-field>
      <ui-field label="Altura (m)"><input uiFieldControl appDecimal [appDecimalCasas]="2" style="${estilo}" /></ui-field>
    </div>`,
  }),
};
