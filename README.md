# Traço — caderno à mão para iPhone e iPad

App de anotações (PWA) feito para Apple Pencil: escreve como num caderno, com pressão, e funciona offline depois de instalado.

## O que tem

- Caneta, lápis (com textura) e marca-texto, com pressão da Apple Pencil, cores e espessuras
- Borracha parcial, de traço inteiro e "só marca-texto"
- Laço para selecionar, mover, girar, redimensionar, recolorir, copiar/colar, duplicar e transformar em figurinha
- Segurar a caneta no fim do traço vira linha reta, círculo ou retângulo
- Texto com 22 fontes do iOS + importação de fontes próprias (.ttf/.otf/.woff)
- Importar PDF para anotar: cada PDF vira um caderno (ou entra como páginas no caderno aberto), e depois exporta de volta em PDF com as anotações
- Imagens da galeria/câmera, página com imagem de fundo (para anotar em cima de fotos ou slides)
- Figurinhas: pacote planner, emojis e figurinhas próprias
- Papéis liso, pautado, quadriculado, pontilhado, Cornell e partitura, em cinco cores, retrato ou paisagem
- Vários cadernos com capa, várias páginas (duplicar, reordenar, apagar)
- Desfazer/refazer (botões, toque com 2/3 dedos, ⌘Z)
- Laser para apresentar
- Exportar PDF (caderno ou página), PNG, e arquivo `.traco.json` reimportável; backup de todos os cadernos
- Salvamento automático no aparelho (IndexedDB)

## Publicar no GitHub Pages (grátis)

1. Crie um repositório (ex.: `traco`) e envie todos os arquivos desta pasta para a raiz dele.
2. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em um ou dois minutos o app fica em `https://SEU-USUARIO.github.io/traco/`.

Para testar no computador antes: `python -m http.server 8000` dentro da pasta e abra `http://localhost:8000`.

## Instalar no iPhone / iPad

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone: o app roda em tela cheia e funciona sem internet.

Observação: no iOS, o app instalado na Tela de Início guarda os dados separado do Safari. Use sempre o ícone, e faça backup pelo botão "Backup de todos".

## Estrutura

- `index.html` — telas e ícones
- `app.css` — visual (tema claro e escuro)
- `js/store.js` — banco local (IndexedDB), imagens e fontes
- `js/ink.js` — traços com pressão, papéis, figurinhas, formas e gerador de PDF
- `js/app.js` — interface, gestos, ferramentas, exportação
- `sw.js` + `manifest.json` — instalação e modo offline
- `vendor/` — [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (licença Apache 2.0) para ler PDFs sem internet

## Próximos passos possíveis

- Busca no texto dos PDFs importados
- Sincronizar entre aparelhos (iCloud via app nativo, ou um backend como Supabase/Firebase)
- Virar app da App Store empacotando com Capacitor (precisa de um Mac com Xcode)
