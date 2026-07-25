<script setup lang="ts">
/**
 * Landing publique de Commander Builder.
 * Présente le produit avec des captures réelles du compte de démonstration,
 * dans le design « Grimoire arcanique » (tokens --ink, --gold, Cinzel/Alegreya).
 * Layout autonome (header + footer propres, sans la nav applicative).
 */
definePageMeta({ layout: false })

const colorMode = useColorMode()
const { user } = useAuth()

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

useSeoMeta({
  title: 'Commander Builder — quels commandants jouer, et compléter tes decks au meilleur prix',
  description:
    'Importe ta collection Magic (export ManaBox) et tes decklists. Commander Builder détecte tes commandants jouables et mesure la complétion de n\'importe quel deck, avec le budget d\'achat priorisé à l\'édition la moins chère. Gratuit, sans email.',
  ogTitle: 'Commander Builder',
  ogDescription:
    'Sais quels commandants tu peux jouer, et complète tes decks au meilleur prix. Gratuit, sans email — juste un pseudo.',
  ogImage: '/screenshots/decks.webp',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

// Sections produit, alternées gauche/droite (index pair = capture à droite).
const features = [
  {
    eyebrow: 'Ta collection',
    title: 'Importe ta collection en un fichier',
    body: 'Exporte ta collection depuis ManaBox et dépose le CSV. Tes cartes et tes decklists sont fusionnés en un pool unique, réparti par identité de couleur — sans jamais dépendre du nom ou de la langue : le matching se fait sur l\'identifiant Scryfall.',
    image: '/screenshots/inventaire.webp',
    alt: 'Vue Inventaire : total de cartes, uniques, répartition par couleur et liste des decks.',
  },
  {
    eyebrow: 'Tes commandants',
    title: 'Découvre les commandants que tu peux jouer',
    body: 'Commander Builder repère automatiquement, dans ton pool, toutes les cartes légales comme commandant. Filtre par identité de couleur pour trouver ta prochaine table de commander.',
    image: '/screenshots/commandants.webp',
    alt: 'Grille des commandants jouables détectés dans le pool, filtrables par couleur.',
  },
  {
    eyebrow: 'Le comparateur',
    title: 'Mesure la complétion de n\'importe quel deck',
    body: 'Colle une decklist ou choisis un de tes decks : tu vois immédiatement ton taux de complétion, les cartes manquantes, et le coût pour les acheter — toujours chiffré à l\'édition la moins chère. Les terrains de base sont considérés comme acquis.',
    image: '/screenshots/comparateur.webp',
    alt: 'Comparateur : anneau de complétion, cartes manquantes et coût au meilleur prix.',
  },
  {
    eyebrow: 'Les decks',
    title: 'Explore les decks classés pour ta collection',
    body: 'Les decks moyens EDHREC sont classés par compatibilité avec ce que tu possèdes. Ouvre une fiche pour la liste d\'achat priorisée, les statistiques (courbe de mana, couleurs, types) et le budget de complétion.',
    image: '/screenshots/deck-detail.webp',
    alt: 'Fiche deck : complétion du deck moyen, budget et cartes à acheter en priorité.',
  },
]
</script>

<template>
  <div class="landing">
    <!-- Header -->
    <header class="lp-header">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <AppSigil class="h-7 w-7 shrink-0" />
          <span class="brand">Commander Builder</span>
        </NuxtLink>

        <div class="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            class="btn btn--ghost p-2"
            :aria-label="colorMode.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'"
            @click="toggleColorMode"
          >
            <svg v-if="colorMode.value === 'dark'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
              <circle cx="12" cy="12" r="4.5" />
              <path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-5 w-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
            </svg>
          </button>

          <template v-if="user">
            <NuxtLink to="/inventaire" class="btn btn--primary px-4 py-2">Ouvrir mon inventaire</NuxtLink>
          </template>
          <template v-else>
            <NuxtLink to="/login" class="btn btn--secondary px-4 py-2">Se connecter</NuxtLink>
            <NuxtLink to="/register" class="btn btn--primary px-4 py-2">Créer un compte</NuxtLink>
          </template>
        </div>
      </div>
    </header>

    <main>
      <!-- Hero -->
      <section class="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center anim-stagger">
        <p class="hero-eyebrow">Deck building pour Magic: The Gathering — format Commander</p>
        <h1 class="hero-title">Sais quels commandants tu peux jouer,<br class="hidden sm:block"> et complète tes decks au meilleur prix.</h1>
        <p class="hero-lede">
          Importe ta collection et tes decklists. Commander Builder te dit quels commandants sont à ta portée
          et combien il te manque pour n'importe quel deck — chiffré à l'édition la moins chère.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <NuxtLink v-if="!user" to="/register" class="btn btn--primary px-6 py-2.5 text-base">Créer un compte</NuxtLink>
          <NuxtLink v-else to="/inventaire" class="btn btn--primary px-6 py-2.5 text-base">Ouvrir mon inventaire</NuxtLink>
          <NuxtLink v-if="!user" to="/login" class="btn btn--secondary px-6 py-2.5 text-base">Se connecter</NuxtLink>
        </div>
        <p class="mt-4 text-sm text-muted">Gratuit, sans email — juste un pseudo.</p>

        <figure class="hero-shot anim-rise">
          <img
            src="/screenshots/decks.webp"
            width="2880"
            height="1800"
            alt="Vue Decks : decks moyens EDHREC classés par compatibilité avec la collection, avec budget de complétion."
            class="shot-img"
          >
        </figure>
      </section>

      <!-- Sections produit -->
      <section class="mx-auto max-w-6xl px-4 py-8">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          class="feature"
          :class="{ 'feature--reverse': i % 2 === 1 }"
        >
          <div class="feature__text">
            <p class="feature__eyebrow">{{ f.eyebrow }}</p>
            <h2 class="feature__title">{{ f.title }}</h2>
            <p class="feature__body">{{ f.body }}</p>
          </div>
          <figure class="feature__figure">
            <img
              :src="f.image"
              width="2880"
              height="1800"
              :alt="f.alt"
              loading="lazy"
              class="shot-img"
            >
          </figure>
        </div>
      </section>

      <!-- Réassurance -->
      <section class="mx-auto max-w-4xl px-4 py-12">
        <div class="panel reassurance">
          <h2 class="reassurance__title">Gratuit, sans email — juste un pseudo</h2>
          <p class="reassurance__body">
            Aucune adresse email n'est collectée : tu crées un compte avec un simple pseudonyme.
            Tes données de carte viennent de Scryfall, les statistiques de popularité d'EDHREC —
            rien n'est revendu, l'application reste gratuite.
          </p>
          <div class="mt-6">
            <NuxtLink v-if="!user" to="/register" class="btn btn--primary px-6 py-2.5 text-base">Créer mon compte</NuxtLink>
            <NuxtLink v-else to="/inventaire" class="btn btn--primary px-6 py-2.5 text-base">Ouvrir mon inventaire</NuxtLink>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer mx-auto max-w-6xl px-4 py-8 text-center">
      <div class="mb-4 flex items-center justify-center gap-2">
        <AppSigil class="h-5 w-5" />
        <span class="brand text-base">Commander Builder</span>
      </div>
      <p class="footer__legal">
        Commander Builder is unofficial Fan Content permitted under the Fan Content Policy. Not
        approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
        the Coast. ©Wizards of the Coast LLC.
      </p>
      <p class="mt-1 footer__credits">Données cartes et images fournies par Scryfall — statistiques de popularité par EDHREC.</p>
    </footer>
  </div>
</template>

<style scoped>
.lp-header {
  border-bottom: 1px solid var(--ink-border);
  background-color: color-mix(in srgb, var(--ink-bg) 82%, transparent);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.brand {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  color: var(--ink-text);
}

/* ---- Hero ---- */
.hero-eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 1rem;
}

.hero-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.9rem, 5vw, 3.1rem);
  line-height: 1.12;
  color: var(--ink-text);
}

.hero-lede {
  margin: 1.5rem auto 0;
  max-width: 42rem;
  font-size: clamp(1rem, 2.4vw, 1.2rem);
  line-height: 1.6;
  color: var(--ink-text-muted);
}

.hero-shot {
  margin-top: 3rem;
}

/* ---- Captures ---- */
.shot-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.75rem;
  border: 1px solid var(--ink-border-strong);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 4%) inset,
    0 24px 60px -24px var(--ink-shadow);
}

.hero-shot .shot-img {
  max-width: 68rem;
  margin-inline: auto;
}

/* ---- Sections produit ---- */
.feature {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
  align-items: center;
  padding: 2.5rem 0;
}

.feature + .feature {
  border-top: 1px solid var(--ink-border);
}

@media (min-width: 768px) {
  .feature {
    grid-template-columns: 5fr 7fr;
    gap: 3.5rem;
    padding: 4rem 0;
  }
  .feature--reverse .feature__text {
    order: 2;
  }
  .feature--reverse .feature__figure {
    order: 1;
  }
}

.feature__eyebrow {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 0.6rem;
}

.feature__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 3.2vw, 2rem);
  line-height: 1.2;
  color: var(--ink-text);
}

.feature__body {
  margin-top: 1rem;
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--ink-text-muted);
}

/* ---- Réassurance ---- */
.reassurance {
  padding: 2.5rem 2rem;
  text-align: center;
}

.reassurance__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 3.5vw, 2rem);
  color: var(--ink-text);
}

.reassurance__body {
  margin: 1.25rem auto 0;
  max-width: 38rem;
  line-height: 1.65;
  color: var(--ink-text-muted);
}

/* ---- Footer ---- */
.footer {
  border-top: 1px solid var(--ink-border);
  margin-top: 2rem;
}
.footer__legal {
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  color: var(--ink-text-muted);
  max-width: 46rem;
  margin-inline: auto;
}
.footer__credits {
  font-size: 0.72rem;
  color: var(--ink-text-muted);
  opacity: 0.85;
}
</style>
