<script lang="ts">
  import "../app.css";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { theme } from "$lib/theme.svelte";

  let { children }: { children: Snippet } = $props();

  onMount(() => theme.init());
</script>

<div class="h-screen">
  {@render children()}
</div>
