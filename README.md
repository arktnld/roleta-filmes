# Roleta de Filmes

Uma roleta interativa de filmes com visual retrô estilo 16-bit/Nintendo. Escolha filtros e deixe a sorte decidir o que assistir!

**[Demo Online](https://filmes-demo.surge.sh)**

![Preview](https://img.shields.io/badge/Filmes-15000+-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Funcionalidades

- **Roleta Animada**: Animação estilo slot machine com 1, 3, 6 ou 9 filmes por sorteio
- **Filtros Avançados**: Gênero, década, nota mínima e ordenação (ano, nota, aleatório)
- **Busca Inteligente**: Por título ou por pessoa (ator/diretor) com filtros combinados
- **Listas Pessoais**: "Quero Ver" e "Já Vi" sincronizadas na nuvem via Turso
- **Sistema de Notas**: Avalie filmes de 1 a 10 estrelas ao marcar como assistido
- **Detalhes Completos**: Sinopse, elenco, diretor, trailer e onde assistir (streaming)
- **Histórico Inteligente**: Evita repetir filmes sorteados recentemente
- **Efeitos Sonoros**: Sons retrô com opção de mudo
- **PWA**: Instale como app no celular (funciona offline)
- **Responsivo**: Interface adaptada para desktop e mobile
- **Easter Egg**: Konami Code para modo secreto

## Tecnologias

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Estilo**: Visual 16-bit retrô com pixel art
- **APIs**:
  - [TMDB](https://www.themoviedb.org/) - Detalhes dos filmes, posters, trailers
  - [Turso](https://turso.tech/) - Banco de dados SQLite para listas de usuário
- **Hospedagem**: [Surge.sh](https://surge.sh/) - Deploy gratuito de sites estáticos

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

### Surge.sh (Recomendado)

1. Instale o Surge:
```bash
npm install -g surge
```

2. Faça deploy:
```bash
surge . seu-site.surge.sh
```

3. Pronto! Seu site estará em `https://seu-site.surge.sh`

### GitHub Pages

1. Fork este repositório
2. Vá em **Settings > Pages**
3. Selecione branch `master` e pasta `/ (root)`
4. Seu site estará em: `https://seu-usuario.github.io/roleta-filmes/`

### Netlify

1. Acesse [netlify.com](https://www.netlify.com/) e faça login
2. Arraste a pasta do projeto para a área de deploy

### Vercel

1. Acesse [vercel.com](https://vercel.com/) e conecte seu GitHub
2. Importe o repositório e faça deploy

### Cloudflare Pages

1. Acesse [pages.cloudflare.com](https://pages.cloudflare.com/)
2. Conecte seu GitHub e selecione o repositório

## Configuração do Turso (Obrigatório)

**As listas "Quero Ver" e "Já Vi" requerem um banco de dados Turso.** Sem essa configuração, essas funcionalidades não funcionarão.

### Passo a passo:

1. Acesse [turso.tech](https://turso.tech/) e crie uma conta
2. Instale o CLI:
```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
```

3. Crie um banco de dados:
```bash
turso db create roleta-filmes
turso db show roleta-filmes --url  # Copie a URL
turso db tokens create roleta-filmes  # Copie o token
```

4. Crie as tabelas:
```bash
turso db shell roleta-filmes
```
```sql
CREATE TABLE watched (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imdb_id TEXT NOT NULL UNIQUE,
  rating INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imdb_id TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

5. Atualize em `config.js`:
```javascript
TURSO_URL: 'libsql://seu-banco-seu-usuario.turso.io',
TURSO_TOKEN: 'seu-token'
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
