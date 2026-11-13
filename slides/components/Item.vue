<script setup lang="ts">
defineProps<{ title: string; text: string }>();
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="text-4xl text-green shrink-0"><slot /></div>
    <div>
      <b>{{ title }}</b><br />
      <span class="opacity-70">{{ text }}</span>
    </div>
  </div>
</template>
