<script setup lang="ts">
defineProps<{ title: string; text: string }>();
</script>

<template>
  <div class="card text-center">
    <div class="text-5xl text-green"><slot /></div>
    <h3>{{ title }}</h3>
    <p>{{ text }}</p>
  </div>
</template>
