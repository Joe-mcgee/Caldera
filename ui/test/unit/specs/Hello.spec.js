import Vue from 'vue';
import Hello from '@/components/HelloWorld';

describe('Hello.vue', () => {
  it('should render correct contents', () => {
    const Constructor = Vue.extend(Hello);
    const vm = new Constructor().$mount();
    expect(vm.$el.querySelector('p').textContent)
      .to.equal('Rendering');
  });
});
