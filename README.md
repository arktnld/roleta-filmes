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
- **Scripts Python**: Importação de listas do Filmow, gerenciamento de categorias

## Estrutura do Projeto

```
roleta_filmes/
├── web/                    # Site estático
│   ├── index.html          # Página principal
│   ├── app.js              # Lógica da aplicação
│   ├── style.css           # Estilos 16-bit
│   ├── movies.json         # Base de dados (15k+ filmes)
│   └── manifest.json       # PWA manifest
├── listas/                 # Listas extraídas do Filmow
├── import_filmow.py        # Importa listas do Filmow
├── add_category.py         # Gerencia categorias/gêneros
├── fix_duplicates.py       # Remove filmes duplicados
└── add_movie.py            # Adiciona filme manualmente
```

## Como Usar Localmente

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/roleta-filmes.git
cd roleta-filmes/web
```

2. Sirva os arquivos (qualquer servidor HTTP):
```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

3. Acesse `http://localhost:8000`

## Deploy (Publicar Online)

### GitHub Pages (Recomendado)

1. Crie um repositório no GitHub
2. Faça push do conteúdo da pasta `web/`:
```bash
cd web
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/roleta-filmes.git
git push -u origin main
```

3. Vá em **Settings > Pages**
4. Em "Source", selecione **Deploy from a branch**
5. Selecione branch `main` e pasta `/ (root)`
6. Clique **Save**

Seu site estará em: `https://seu-usuario.github.io/roleta-filmes/`

### Netlify

1. Acesse [netlify.com](https://www.netlify.com/) e faça login
2. Arraste a pasta `web/` para a área de deploy
3. Pronto! Você receberá uma URL tipo `random-name.netlify.app`

Ou via CLI:
```bash
npm install -g netlify-cli
cd web
netlify deploy --prod --dir=.
```

### Vercel

1. Acesse [vercel.com](https://vercel.com/) e conecte seu GitHub
2. Importe o repositório
3. Configure:
   - **Root Directory**: `web`
   - **Framework Preset**: Other
4. Deploy!

### Cloudflare Pages

1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com/)
2. Conecte seu GitHub
3. Selecione o repositório
4. Configure:
   - **Build output directory**: `web`
5. Deploy!

## Scripts Python

### Importar lista do Filmow

```bash
# Instalar dependências
pip install requests beautifulsoup4 aiohttp rapidfuzz

# Importar uma lista
python import_filmow.py https://filmow.com/listas/sessao-da-tarde/ --import

# Importar com categoria
python import_filmow.py https://filmow.com/listas/sessao-da-tarde/ --import --category "Sessão da Tarde"

# Importar várias listas de arquivo
python import_filmow.py --batch urls.txt --import

# Importar com configuração JSON
python import_filmow.py --config listas.json
```

Formato do arquivo de configuração (`listas.json`):
```json
[
  {
    "urls": ["https://filmow.com/listas/lista1/", "https://filmow.com/listas/lista2/"],
    "categories": ["Categoria1", "Categoria2"]
  }
]
```

### Gerenciar categorias

```bash
# Adicionar categoria a uma lista
python add_category.py listas/sessao-da-tarde.json "Sessão da Tarde"

# Remover categoria
python add_category.py --remove "Categoria"

# Listar todas as categorias
python add_category.py --list-genres

# Adicionar por IMDB ID
python add_category.py --imdb tt0111161 "Clássico"
```

### Corrigir duplicados

```bash
# Ver duplicados
python fix_duplicates.py

# Remover duplicados
python fix_duplicates.py --fix
```

## Configuração do Supabase

Para salvar listas "Quero Ver" e "Já Vi":

1. Crie uma conta em [supabase.com](https://supabase.com/)
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute:

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

4. Vá em **Settings > API** e copie:
   - Project URL
   - anon public key

5. Atualize em `app.js` no objeto `CONFIG`:
```javascript
SUPABASE_URL: 'https://seu-projeto.supabase.co',
SUPABASE_KEY: 'sua-anon-key'
```

## Licença

MIT License - Sinta-se livre para usar e modificar.

## Créditos

- Dados de filmes: [TMDB](https://www.themoviedb.org/)
- Listas: [Filmow](https://filmow.com/)
- Ícones: SVG Repo
