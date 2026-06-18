# Manual do Usuário - Sala de Apoio (DAINF/UTFPR)

Bem-vindo ao manual oficial de utilização do sistema de gerenciamento da Sala de Apoio do DAINF (Departamento Acadêmico de Informática) da UTFPR. 

Este documento foi criado para ajudar Administradores, Técnicos de Laboratório, Professores e Alunos a entenderem e utilizarem os recursos do sistema com eficiência.

---

## 1. Visão Geral dos Perfis (Roles)

O sistema conta com diferentes níveis de acesso para garantir a segurança e a organização do laboratório:

- **Administrador (ADMIN) / Técnico (LAB_TECHNICIAN):** Possuem acesso total ao sistema. Podem cadastrar novos usuários, itens, categorias, aprovar reservas, gerenciar compras e **realizar devoluções (Saídas)**.
- **Aluno (STUDENT) / Professor (PROFESSOR):** Possuem acesso restrito. Podem apenas solicitar Reservas e Empréstimos em seu próprio nome. Não podem acessar configurações, cadastros administrativos ou registrar devoluções de ferramentas.

---

## 2. Leitura Rápida (Código de Barras)

Para agilizar o atendimento no balcão da Sala de Apoio, o sistema possui integração inteligente com leitores de código de barras nas telas de **Reservas, Empréstimos e Saídas**.

### Como utilizar:
1. Na criação de uma nova reserva ou empréstimo, clique no campo destacado chamado **"Leitura Rápida"**.
2. **Para identificar o Aluno/Usuário:** Utilize o leitor na carteirinha do aluno (lendo o RA/Matrícula). O sistema selecionará automaticamente o nome da pessoa vinculada.
3. **Para identificar a Ferramenta:** Utilize o leitor na etiqueta da ferramenta (lendo o número do Patrimônio/Série ou SIORG). O sistema adicionará a ferramenta à lista automaticamente.
4. *Dica:* Não é necessário clicar em botões adicionais; o sistema reconhece automaticamente pelo número "bipado" se trata-se de um usuário ou de um equipamento.

---

## 3. Principais Módulos

### 3.1. Dashboard (Início)
A tela inicial fornece uma visão geral do laboratório, incluindo a quantidade de itens emprestados, reservas pendentes e alertas rápidos sobre ferramentas em atraso.

### 3.2. Operações Diárias

#### Empréstimos
Usado para ferramentas que estão sendo retiradas no exato momento.
- Alunos e Professores podem registrar a retirada (ficando sob sua responsabilidade).
- Administradores e Técnicos podem selecionar para qual aluno estão emprestando a ferramenta (usando o Leitor de Código de Barras).

#### Reservas
Usado para agendar a retirada de uma ferramenta para o futuro.
- **Status Pendente:** Toda nova reserva entra com o status "Pendente" aguardando aprovação.
- Alunos apenas reservam para si próprios.

#### Saídas (Devoluções)
**Acesso Exclusivo:** Administradores e Técnicos.
- Quando o aluno devolve o material no balcão, o administrador acessa a aba "Saída".
- Usando a **Leitura Rápida**, basta bipar o RA do aluno ou a etiqueta do equipamento para encontrar o empréstimo ativo e confirmar a devolução de forma instantânea.

### 3.3. Cadastros Gerais (Acesso Administrativo)
- **Itens:** Gerenciamento do inventário físico (nome, descrição, patrimônio, categoria).
- **Usuários:** Cadastro de novos alunos, definição de papéis (roles) e senhas. *Atenção: É fundamental que o campo Matrícula/RA seja preenchido corretamente para que o Leitor de Código de Barras funcione.*
- **Categorias e Fornecedores:** Organização dos equipamentos e origem de compras.

---

## 4. Resolução de Problemas Comuns

- **"Meu leitor de código de barras não está funcionando!"**
  Certifique-se de ter clicado **dentro do campo "Leitura Rápida"** antes de apertar o gatilho do leitor.
  
- **"O aluno alega ter devolvido a ferramenta, mas ele mesmo não consegue dar baixa."**
  Isto é o comportamento esperado. Por questões de segurança, apenas a administração (Técnicos e Admins) possui acesso à aba "Saídas" para dar baixa real em um equipamento retornado.

- **"Erro ao enviar e-mail no cadastro de usuário."**
  Se a tela de cadastro não estiver finalizando por erro de e-mail, peça ao Administrador para verificar as credenciais (App Password) do e-mail configurado no servidor (backend) ou continuar utilizando o cadastro pois o sistema ignorará a falha de envio silenciosamente.

---
*Gerado automaticamente pelo Assistente IA (Antigravity).*
