# Roleta de Filmes

Uma roleta interativa de filmes com visual retrô estilo 16-bit/Nintendo. Escolha filtros e deixe a sorte decidir o que assistir!

**[Demo Online](https://roleta-filmes-demo.netlify.app)**

![Preview](https://img.shields.io/badge/Filmes-15000+-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Funcionalidades

- **Roleta Animada**: Animação estilo slot machine para escolher filmes aleatórios
- **Filtros Avançados**: Filtre por gênero, década e nota mínima
- **Busca**: Encontre filmes por nome com filtros combinados
- **Listas Pessoais**: Salve filmes em "Quero Ver" e "Já Vi" (sincronizado via Supabase)
- **Detalhes Completos**: Modal com sinopse, elenco, diretor, trailer e streaming
- **PWA**: Instale como app no celular
- **Responsivo**: Funciona em desktop e mobile

## Tecnologias

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Estilo**: Visual 16-bit retrô com pixel art
- **APIs**:
  - [TMDB](https://www.themoviedb.org/) - Detalhes dos filmes, posters, trailers
  - [Supabase](https://supabase.com/) - Autenticação e listas de usuário
## Estrutura do Projeto

```
roleta-filmes/
├── index.html          # Página principal
├── app.js              # Lógica da aplicação
├── style.css           # Estilos 16-bit
├── movies.json         # Base de dados (15k+ filmes)
├── config.example.js   # Template de configuração
├── config.js           # Suas credenciais (não commitado)
└── manifest.json       # PWA manifest
```

## Como Usar

1. Clone o repositório:
```bash
git clone https://github.com/arktnld/roleta-filmes.git
cd roleta-filmes
```

2. Copie o arquivo de configuração:
```bash
cp config.example.js config.js
```

3. Edite `config.js` com suas credenciais (veja seções abaixo)

4. Sirva os arquivos (qualquer servidor HTTP):
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

5. Acesse `http://localhost:8000`

## Deploy (Publicar Online)

### GitHub Pages

1. Fork este repositório
2. Vá em **Settings > Pages**
3. Em "Source", selecione **Deploy from a branch**
4. Selecione branch `master` e pasta `/ (root)`
5. Clique **Save**

Seu site estará em: `https://seu-usuario.github.io/roleta-filmes/`

### Netlify

1. Acesse [netlify.com](https://www.netlify.com/) e faça login
2. Arraste a pasta do projeto para a área de deploy
3. Pronto! Você receberá uma URL tipo `random-name.netlify.app`

### Vercel

1. Acesse [vercel.com](https://vercel.com/) e conecte seu GitHub
2. Importe o repositório
3. Deploy!

### Cloudflare Pages

1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com/)
2. Conecte seu GitHub
3. Selecione o repositório
4. Deploy!

## Configuração do Supabase (Obrigatório)

**As listas "Quero Ver" e "Já Vi" requerem um banco de dados Supabase.** Sem essa configuração, essas funcionalidades não funcionarão.

### Passo a passo:

1. Acesse [supabase.com](https://supabase.com/) e clique em **Start your project**
2. Crie uma conta (pode usar GitHub, Google ou email)
3. Clique em **New Project**
4. Preencha:
   - **Name**: nome do projeto (ex: `roleta-filmes`)
   - **Database Password**: gere uma senha qualquer
   - **Region**: escolha a mais próxima de você
5. Aguarde ~2 minutos enquanto o projeto é criado
6. Vá em **SQL Editor** (menu lateral) e execute:

```sql
-- Tabela de filmes já vistos
CREATE TABLE watched (
  id SERIAL PRIMARY KEY,
  imdb_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de filmes para assistir
CREATE TABLE watchlist (
  id SERIAL PRIMARY KEY,
  imdb_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissões públicas
ALTER TABLE watched ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on watched" ON watched FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on watchlist" ON watchlist FOR ALL USING (true) WITH CHECK (true);
```

7. Vá em **Settings > API** (menu lateral) e copie:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon public key** (a chave longa que começa com `eyJ...`)

8. Atualize em `config.js`:
```javascript
SUPABASE_URL: 'https://seu-projeto.supabase.co',
SUPABASE_KEY: 'sua-anon-key'
```

## Configuração do TMDB (Obrigatório)

**O TMDB é usado para buscar detalhes dos filmes, posters e trailers.** Sem o token, o modal de detalhes não funcionará.

### Passo a passo:

1. Acesse [themoviedb.org](https://www.themoviedb.org/) e crie uma conta
2. Vá em **Settings > API** (ou acesse direto: [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
3. Clique em **Create** ou **Request an API Key**
4. Selecione **Developer** e aceite os termos
5. Preencha o formulário (pode colocar dados básicos, é só para registro)
6. Copie o **API Read Access Token** (Bearer token, começa com `eyJ...`)
7. Atualize em `config.js`:
```javascript
TMDB_TOKEN: 'seu-token-aqui'
```

## Licença

MIT License - Sinta-se livre para usar e modificar.

## Créditos

- Dados de filmes: [TMDB](https://www.themoviedb.org/)
- Listas: [Filmow](https://filmow.com/)
- Ícones: SVG Repo
