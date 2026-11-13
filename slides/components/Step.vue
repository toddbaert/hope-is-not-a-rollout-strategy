<script setup lang="ts">
// one step of the maturity model; color and height grow with the level
const props = defineProps<{ level: number; title: string; text: string }>();
const color = ['#e5484d', '#f5a524', 'var(--of-accent-purple)', 'var(--of-green-text)'][props.level];
</script>

<template>
  <div
    class="flex-1 rounded-t-lg p-3 border-t-4"
    :style="{ height: `${9 + 3 * level}rem`, borderColor: color, background: `color-mix(in srgb, ${color} 22%, transparent)` }"
  >
    <div class="text-2xl font-bold" :style="{ color }">{{ level }}</div>
    <div class="font-semibold leading-tight">{{ title }}</div>
    <div class="text-sm opacity-70 mt-1 leading-snug">{{ text }}</div>
  </div>
</template>
