<script lang="ts" module>
  export type IconName =
    | "close"
    | "trash"
    | "eye"
    | "external-link"
    | "pencil"
    | "file"
    | "image"
    | "paperclip"
    | "calendar"
    | "folder"
    | "folder-open"
    | "check-circle";
</script>

<script lang="ts">
  let { name, class: className = "" }: { name: IconName; class?: string } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
>
  {#if name === "close"}
    <path d="M18 6 6 18M6 6l12 12" />
  {:else if name === "trash"}
    <path
      d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16ZM10 11v6M14 11v6"
    />
  {:else if name === "eye"}
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "external-link"}
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
  {:else if name === "pencil"}
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  {:else if name === "file"}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  {:else if name === "image"}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  {:else if name === "paperclip"}
    <path
      d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a1.5 1.5 0 0 1-2.12-2.12l8.48-8.48"
    />
  {:else if name === "calendar"}
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  {:else if name === "folder"}
    <path
      d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"
    />
  {:else if name === "folder-open"}
    <path
      d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H7l-2.5 8H3Z"
    />
    <path d="M4.5 19 7 11h14l-2.5 8Z" />
  {:else if name === "check-circle"}
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  {/if}
</svg>
