import type { ToolCategoryMeta } from './toolTypes.js';

interface Props {
  categories: ToolCategoryMeta[];
  selected: string;
  onSelect: (cat: string) => void;
}

export function ToolCategoryNav({ categories, selected, onSelect }: Props) {
  return (
    <nav className="cat-nav">
      <div className="cat-nav__heading">Categories</div>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`cat-nav__item${selected === cat.id ? ' cat-nav__item--active' : ''}`}
          onClick={() => onSelect(cat.id)}
        >
          <span className="cat-nav__icon">{cat.icon}</span>
          <span className="cat-nav__label">{cat.label}</span>
          <span className="cat-nav__count">{cat.count}</span>
        </button>
      ))}
    </nav>
  );
}
