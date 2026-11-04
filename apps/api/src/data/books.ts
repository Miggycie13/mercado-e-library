export type SeedBook = {
  title: string;
  author: string;
  category: string;
  year: number;
  themes: string;
  gutenbergId?: number;
};

const RAW = `
Drama|1601|William Shakespeare|Hamlet|revenge ghost denmark court
Drama|1606|William Shakespeare|Macbeth|ambition prophecy scotland witches
Drama|1604|William Shakespeare|Othello|jealousy venice betrayal soldier
Drama|1606|William Shakespeare|King Lear|madness family kingdom storm
Drama|1597|William Shakespeare|Romeo and Juliet|love verona tragedy youth
Drama|1596|William Shakespeare|A Midsummer Night's Dream|fairies forest love comedy
Drama|1611|William Shakespeare|The Tempest|island magic shipwreck forgiveness
Drama|1599|William Shakespeare|Julius Caesar|rome conspiracy politics assassination
Drama|1601|William Shakespeare|Twelfth Night|disguise shipwreck comedy love
Drama|1599|William Shakespeare|Much Ado About Nothing|wit soldiers comedy romance
Drama|1597|William Shakespeare|The Merchant of Venice|court justice bond comedy
Drama|1599|William Shakespeare|As You Like It|forest exile comedy romance
Drama|1594|William Shakespeare|The Taming of the Shrew|comedy marriage wit
Drama|1593|William Shakespeare|Richard III|throne ambition history war
Drama|1599|William Shakespeare|Henry V|war france king soldiers
Drama|1607|William Shakespeare|Antony and Cleopatra|egypt rome love empire
Drama|1611|William Shakespeare|The Winter's Tale|jealousy reunion pastoral
Drama|1604|William Shakespeare|Measure for Measure|justice vienna disguise
Drama|1596|William Shakespeare|King John|succession england politics
Drama|1608|William Shakespeare|Coriolanus|rome pride politics war
Drama|1610|William Shakespeare|Cymbeline|britain romance intrigue
Drama|1602|William Shakespeare|Troilus and Cressida|troy war love satire
Drama|1606|William Shakespeare|Timon of Athens|wealth generosity misanthropy
Drama|1608|William Shakespeare|Pericles|voyage shipwreck family
Drama|1594|William Shakespeare|The Comedy of Errors|twins mistaken identity comedy
Drama|1595|William Shakespeare|Love's Labour's Lost|wit court comedy scholars
Drama|1594|William Shakespeare|The Two Gentlemen of Verona|friendship travel love
Drama|1605|William Shakespeare|All's Well That Ends Well|romance healing court
Drama|1600|William Shakespeare|The Merry Wives of Windsor|comedy jealousy town
Drama|1594|William Shakespeare|Titus Andronicus|rome revenge tragedy
Drama|1597|William Shakespeare|Henry IV, Part 1|falstaff rebellion prince war
Drama|1598|William Shakespeare|Henry IV, Part 2|falstaff crown succession
Drama|1591|William Shakespeare|Henry VI, Part 1|france war history
Drama|1591|William Shakespeare|Henry VI, Part 2|rebellion court history
Drama|1591|William Shakespeare|Henry VI, Part 3|roses war throne
Drama|1595|William Shakespeare|Richard II|deposition crown england
Drama|1613|William Shakespeare|Henry VIII|tudor court history
Poetry|1609|William Shakespeare|Shakespeare's Sonnets|love time poetry sonnets
Poetry|1798|William Wordsworth|Lyrical Ballads|nature poetry romantic
Poetry|1798|Samuel Taylor Coleridge|The Rime of the Ancient Mariner|sea curse sailor poetry
Poetry|1818|John Keats|Endymion|poetry myth beauty
Poetry|1819|John Keats|Lamia, Isabella, The Eve of St. Agnes|poetry romance myth
Poetry|1855|Walt Whitman|Leaves of Grass|america poetry democracy
Poetry|1890|Emily Dickinson|Poems by Emily Dickinson|poetry death nature solitude
Poetry|1845|Edgar Allan Poe|The Raven and Other Poems|raven poetry melancholy
Poetry|1789|William Blake|Songs of Innocence|poetry childhood lamb
Poetry|1794|William Blake|Songs of Experience|poetry tyger innocence
Poetry|1859|Alfred Tennyson|Idylls of the King|arthur camelot poetry
Poetry|1667|John Milton|Paradise Lost|eden fall epic poetry
Poetry|1320|Dante Alighieri|The Divine Comedy|inferno purgatory paradise epic
Poetry|1387|Geoffrey Chaucer|The Canterbury Tales|pilgrims storytelling england
Poetry|800|Unknown|Beowulf|monster hero dragon epic
Poetry|800|Homer|The Iliad|troy war achilles
Poetry|700|Homer|The Odyssey|voyage odysseus sea home
Fiction|1813|Jane Austen|Pride and Prejudice|manners marriage wit england|1342
Fiction|1811|Jane Austen|Sense and Sensibility|sisters love inheritance|161
Fiction|1815|Jane Austen|Emma|matchmaking village comedy|158
Fiction|1814|Jane Austen|Mansfield Park|estate morality family|141
Fiction|1818|Jane Austen|Northanger Abbey|gothic satire novels|121
Fiction|1818|Jane Austen|Persuasion|second chance navy love|105
Fiction|1794|Jane Austen|Lady Susan|letters wit scandal
Fiction|1838|Charles Dickens|Oliver Twist|orphan london crime|730
Fiction|1843|Charles Dickens|A Christmas Carol|ghosts greed redemption london|46
Fiction|1850|Charles Dickens|David Copperfield|childhood memory growing up|766
Fiction|1853|Charles Dickens|Bleak House|court fog inheritance london|1023
Fiction|1861|Charles Dickens|Great Expectations|orphan gentleman ambition|1400
Fiction|1859|Charles Dickens|A Tale of Two Cities|revolution paris london sacrifice|98
Fiction|1854|Charles Dickens|Hard Times|industry school fact city
Fiction|1839|Charles Dickens|Nicholas Nickleby|school cruelty family
Fiction|1837|Charles Dickens|The Pickwick Papers|travel comedy england
Fiction|1857|Charles Dickens|Little Dorrit|prison debt family london
Fiction|1865|Charles Dickens|Our Mutual Friend|river inheritance london
Fiction|1841|Charles Dickens|The Old Curiosity Shop|journey shop grandfather
Fiction|1841|Charles Dickens|Barnaby Rudge|riot london history
Fiction|1844|Charles Dickens|Martin Chuzzlewit|greed america family
Fiction|1848|Charles Dickens|Dombey and Son|pride business family
Fiction|1847|Charlotte Bronte|Jane Eyre|governess manor love independence|1260
Fiction|1847|Emily Bronte|Wuthering Heights|moors obsession revenge|768
Fiction|1853|Charlotte Bronte|Villette|teacher city solitude
Fiction|1848|Anne Bronte|The Tenant of Wildfell Hall|marriage independence painter
Fiction|1872|George Eliot|Middlemarch|town ambition marriage reform|145
Fiction|1860|George Eliot|The Mill on the Floss|river siblings family
Fiction|1861|George Eliot|Silas Marner|weaver gold village child
Fiction|1859|George Eliot|Adam Bede|village carpenter love
Fiction|1853|Elizabeth Gaskell|Cranford|village women community
Fiction|1855|Elizabeth Gaskell|North and South|mill town class industry
Fiction|1848|Elizabeth Gaskell|Mary Barton|manchester workers mystery
Fiction|1876|Mark Twain|The Adventures of Tom Sawyer|boy river adventure mischief|74
Fiction|1884|Mark Twain|Adventures of Huckleberry Finn|river raft freedom friendship|76
Fiction|1881|Mark Twain|The Prince and the Pauper|identity london swap
Fiction|1889|Mark Twain|A Connecticut Yankee in King Arthur's Court|time travel camelot satire
Fiction|1869|Mark Twain|The Innocents Abroad|travel satire voyage
Fiction|1883|Mark Twain|Life on the Mississippi|river pilot memoir america
Fiction|1850|Nathaniel Hawthorne|The Scarlet Letter|puritan guilt village letter
Fiction|1851|Herman Melville|Moby-Dick|whale sea captain obsession ship|2701
Fiction|1852|Herman Melville|Pierre|author identity tragedy
Fiction|1826|James Fenimore Cooper|The Last of the Mohicans|wilderness war frontier
Fiction|1903|Jack London|The Call of the Wild|dog yukon wilderness survival
Fiction|1906|Jack London|White Fang|wolf dog north wilderness
Fiction|1904|Jack London|The Sea-Wolf|ship captain sea survival
Fiction|1909|Jack London|Martin Eden|writer ambition class sea
Fiction|1895|Stephen Crane|The Red Badge of Courage|war fear soldier battle|73
Fiction|1868|Louisa May Alcott|Little Women|sisters family home coming of age|514
Fiction|1871|Louisa May Alcott|Little Men|school boys family
Fiction|1899|Kate Chopin|The Awakening|sea independence new orleans
Fiction|1852|Harriet Beecher Stowe|Uncle Tom's Cabin|slavery freedom america|203
Fiction|1900|L. Frank Baum|The Wonderful Wizard of Oz|kansas wizard road friendship|55
Fiction|1838|Edgar Allan Poe|The Narrative of Arthur Gordon Pym|sea voyage ship mystery
Fiction|1881|Henry James|The Portrait of a Lady|europe heiress independence
Fiction|1880|Henry James|Washington Square|inheritance new york family
Fiction|1898|Henry James|The Turn of the Screw|ghosts governess children mystery
Fiction|1879|Henry James|Daisy Miller|travel innocence europe
Fiction|1911|Edith Wharton|Ethan Frome|winter farm tragedy new england
Fiction|1905|Edith Wharton|The House of Mirth|society new york fall
Fiction|1920|Edith Wharton|The Age of Innocence|society new york marriage
Fiction|1918|Willa Cather|My Antonia|prairie immigrant pioneer
Fiction|1913|Willa Cather|O Pioneers!|prairie land farm
Fiction|1891|Thomas Hardy|Tess of the d'Urbervilles|rural fate tragedy england
Fiction|1874|Thomas Hardy|Far from the Madding Crowd|farm love weather england
Fiction|1886|Thomas Hardy|The Mayor of Casterbridge|market town secret fall
Fiction|1895|Thomas Hardy|Jude the Obscure|learning class ambition
Fiction|1878|Thomas Hardy|The Return of the Native|heath fate rural
Fiction|1899|Joseph Conrad|Heart of Darkness|river congo voyage moral
Fiction|1900|Joseph Conrad|Lord Jim|sea guilt honor ship
Fiction|1904|Joseph Conrad|Nostromo|silver revolution harbor
Fiction|1907|Joseph Conrad|The Secret Agent|london anarchist spy
Fiction|1895|Joseph Conrad|Almayer's Folly|river trade exile
Fiction|1913|D. H. Lawrence|Sons and Lovers|mining family coming of age
Fiction|1915|D. H. Lawrence|The Rainbow|generations farm desire
Fiction|1920|D. H. Lawrence|Women in Love|love industry relationships
Fiction|1922|James Joyce|Ulysses|dublin day odyssey city
Fiction|1914|James Joyce|Dubliners|dublin short stories city
Fiction|1916|James Joyce|A Portrait of the Artist as a Young Man|artist youth ireland
Fiction|1925|F. Scott Fitzgerald|The Great Gatsby|jazz age long island wealth
Fiction|1920|F. Scott Fitzgerald|This Side of Paradise|youth college ambition
Fiction|1922|F. Scott Fitzgerald|The Beautiful and Damned|marriage wealth new york
Fiction|1945|George Orwell|Animal Farm|farm allegory power
Fiction|1949|George Orwell|Nineteen Eighty-Four|surveillance dystopia city
Fiction|1933|George Orwell|Down and Out in Paris and London|poverty kitchens city
Fiction|1934|George Orwell|Burmese Days|colonial town empire
Fiction|1925|Virginia Woolf|Mrs Dalloway|london day party memory
Fiction|1927|Virginia Woolf|To the Lighthouse|family sea time art
Fiction|1928|Virginia Woolf|Orlando|time gender biography fantasy
Essays|1929|Virginia Woolf|A Room of One's Own|essay women writing
Mystery|1887|Arthur Conan Doyle|A Study in Scarlet|detective london murder|244
Mystery|1890|Arthur Conan Doyle|The Sign of the Four|detective treasure london|2097
Mystery|1892|Arthur Conan Doyle|The Adventures of Sherlock Holmes|detective london cases|1661
Mystery|1894|Arthur Conan Doyle|The Memoirs of Sherlock Holmes|detective london cases
Mystery|1902|Arthur Conan Doyle|The Hound of the Baskervilles|detective moor hound mystery|2852
Mystery|1905|Arthur Conan Doyle|The Return of Sherlock Holmes|detective london return|108
Mystery|1915|Arthur Conan Doyle|The Valley of Fear|detective secret society
Adventure|1912|Arthur Conan Doyle|The Lost World|plateau dinosaurs expedition
Adventure|1891|Arthur Conan Doyle|The White Company|medieval archers war
Mystery|1868|Wilkie Collins|The Moonstone|detective diamond india mystery|155
Mystery|1859|Wilkie Collins|The Woman in White|identity mystery asylum
Adventure|1894|Anthony Hope|The Prisoner of Zenda|imposter kingdom adventure romance
Science Fiction|1895|H. G. Wells|The Time Machine|future time travel|35
Science Fiction|1898|H. G. Wells|The War of the Worlds|mars invasion earth|36
Science Fiction|1897|H. G. Wells|The Invisible Man|invisibility scientist village|5230
Science Fiction|1896|H. G. Wells|The Island of Doctor Moreau|island animals experiment|159
Science Fiction|1901|H. G. Wells|The First Men in the Moon|moon voyage science
Science Fiction|1904|H. G. Wells|The Food of the Gods|growth science experiment
Science Fiction|1899|H. G. Wells|When the Sleeper Wakes|future sleep london dystopia
Science Fiction|1908|H. G. Wells|The War in the Air|flying machines war
Science Fiction|1818|Mary Shelley|Frankenstein|creature science creation alps|84
Science Fiction|1826|Mary Shelley|The Last Man|plague future solitude
Adventure|1870|Jules Verne|Twenty Thousand Leagues Under the Seas|submarine ocean captain nemo|164
Adventure|1864|Jules Verne|Journey to the Center of the Earth|volcano underground expedition
Adventure|1873|Jules Verne|Around the World in Eighty Days|wager travel train|103
Adventure|1865|Jules Verne|From the Earth to the Moon|cannon space voyage|83
Adventure|1874|Jules Verne|The Mysterious Island|castaways island engineering
Adventure|1876|Jules Verne|Michael Strogoff|courier russia adventure
Adventure|1863|Jules Verne|Five Weeks in a Balloon|africa balloon exploration
Adventure|1883|Robert Louis Stevenson|Treasure Island|pirates map island|120
Adventure|1886|Robert Louis Stevenson|Kidnapped|scotland flight adventure
Adventure|1886|Robert Louis Stevenson|Strange Case of Dr Jekyll and Mr Hyde|dual identity london science|43
Adventure|1897|Bram Stoker|Dracula|vampire transylvania castle|345
Fiction|1890|Oscar Wilde|The Picture of Dorian Gray|portrait youth london|174
Mystery|1872|Sheridan Le Fanu|Carmilla|vampire castle mystery
Adventure|1885|H. Rider Haggard|King Solomon's Mines|africa treasure expedition
Adventure|1887|H. Rider Haggard|She|lost city immortality africa
Adventure|1887|H. Rider Haggard|Allan Quatermain|africa adventure hunter
Mystery|1910|Gaston Leroux|The Phantom of the Opera|opera paris mask mystery
Children's|1865|Lewis Carroll|Alice's Adventures in Wonderland|rabbit dream logic|11
Children's|1871|Lewis Carroll|Through the Looking-Glass|chess mirror dream|12
Children's|1894|Rudyard Kipling|The Jungle Book|jungle wolf boy animals
Children's|1901|Rudyard Kipling|Kim|spy india road adventure
Children's|1908|Kenneth Grahame|The Wind in the Willows|river mole toad adventure
Children's|1911|J. M. Barrie|Peter and Wendy|neverland flying children
Children's|1911|Frances Hodgson Burnett|The Secret Garden|garden orphan yorkshire
Children's|1905|Frances Hodgson Burnett|A Little Princess|school attic kindness
Children's|1908|L. M. Montgomery|Anne of Green Gables|orphan island imagination
Children's|1906|E. Nesbit|The Railway Children|trains family mystery
Children's|1902|E. Nesbit|Five Children and It|sand fairy wishes
Children's|1877|Anna Sewell|Black Beauty|horse kindness
Children's|1881|Johanna Spyri|Heidi|alps mountain grandfather
Children's|1883|Carlo Collodi|The Adventures of Pinocchio|puppet conscience adventure
Children's|1812|Jacob Grimm|Grimm's Household Tales|fairy tales forest magic
Children's|1835|Hans Christian Andersen|Andersen's Fairy Tales|mermaid snow queen tales
Philosophy|380|Plato|The Republic|justice city philosophy|1497
Philosophy|399|Plato|Apology|trial socrates philosophy
Philosophy|385|Plato|Symposium|love dialogue philosophy
Philosophy|360|Plato|Phaedo|soul death philosophy
Philosophy|340|Aristotle|Nicomachean Ethics|virtue happiness philosophy
Philosophy|335|Aristotle|Poetics|tragedy drama philosophy
Philosophy|330|Aristotle|Politics|state citizenship philosophy
Philosophy|180|Marcus Aurelius|Meditations|stoic duty rome
Philosophy|125|Epictetus|Enchiridion|stoic handbook
Philosophy|400|Augustine of Hippo|Confessions|memory faith autobiography
Philosophy|524|Boethius|The Consolation of Philosophy|fortune prison philosophy
Philosophy|1532|Niccolo Machiavelli|The Prince|power state strategy|1232
Philosophy|1516|Thomas More|Utopia|island society ideal
Philosophy|1637|Rene Descartes|Discourse on the Method|doubt reason philosophy
Philosophy|1689|John Locke|Two Treatises of Government|liberty government rights
Philosophy|1762|Jean-Jacques Rousseau|The Social Contract|freedom government general will
Philosophy|1859|John Stuart Mill|On Liberty|freedom speech individuality
Philosophy|1854|Henry David Thoreau|Walden|woods simple living pond
Philosophy|1849|Henry David Thoreau|Civil Disobedience|conscience government protest
Essays|1841|Ralph Waldo Emerson|Essays: First Series|self-reliance nature essays
Essays|1776|Thomas Paine|Common Sense|independence pamphlet america
History|1776|Edward Gibbon|The History of the Decline and Fall of the Roman Empire|rome empire history
History|430|Herodotus|The Histories|persia greece history
History|400|Thucydides|History of the Peloponnesian War|athens sparta war
History|100|Plutarch|Parallel Lives|greece rome biography
History|117|Tacitus|The Annals|rome emperors history
Science|1859|Charles Darwin|On the Origin of Species|evolution natural selection
Science|1839|Charles Darwin|The Voyage of the Beagle|voyage naturalist galapagos
Science|300|Euclid|Elements|geometry mathematics
Science|1687|Isaac Newton|The Principia|gravity motion mathematics
Science|1861|Michael Faraday|The Chemical History of a Candle|chemistry lecture candle
Fiction|1605|Miguel de Cervantes|Don Quixote|knight windmills spain adventure
Fiction|1759|Voltaire|Candide|satire optimism garden travel
Fiction|1726|Jonathan Swift|Gulliver's Travels|voyage satire islands|829
Essays|1729|Jonathan Swift|A Modest Proposal|satire ireland essay
Fiction|1719|Daniel Defoe|Robinson Crusoe|island survival ship|521
Fiction|1722|Daniel Defoe|Moll Flanders|london survival
Fiction|1678|John Bunyan|The Pilgrim's Progress|allegory journey faith
Fiction|1749|Henry Fielding|The History of Tom Jones, a Foundling|road comedy foundling
Fiction|1764|Horace Walpole|The Castle of Otranto|castle gothic mystery
Fiction|1794|Ann Radcliffe|The Mysteries of Udolpho|castle gothic mystery
Fiction|1862|Victor Hugo|Les Miserables|justice paris revolution mercy|135
Fiction|1831|Victor Hugo|The Hunchback of Notre-Dame|cathedral paris gothic
Fiction|1844|Alexandre Dumas|The Count of Monte Cristo|revenge prison treasure|1184
Fiction|1844|Alexandre Dumas|The Three Musketeers|france sword friendship|1257
Fiction|1850|Alexandre Dumas|The Black Tulip|holland flower intrigue
Fiction|1866|Fyodor Dostoevsky|Crime and Punishment|guilt petersburg murder
Fiction|1880|Fyodor Dostoevsky|The Brothers Karamazov|brothers faith murder
Fiction|1869|Fyodor Dostoevsky|The Idiot|innocence society petersburg
Fiction|1864|Fyodor Dostoevsky|Notes from Underground|alienation city philosophy
Fiction|1869|Leo Tolstoy|War and Peace|napoleon russia war family
Fiction|1878|Leo Tolstoy|Anna Karenina|love society train russia
Fiction|1886|Leo Tolstoy|The Death of Ivan Ilyich|illness death meaning
Fiction|1842|Nikolai Gogol|Dead Souls|russia satire estate
Fiction|1862|Ivan Turgenev|Fathers and Sons|generations russia
Fiction|1857|Gustave Flaubert|Madame Bovary|province desire boredom
Fiction|1885|Emile Zola|Germinal|miners strike france
Fiction|1880|Emile Zola|Nana|paris theatre society
Fiction|1915|Franz Kafka|The Metamorphosis|insect family alienation
Fiction|1925|Franz Kafka|The Trial|court bureaucracy guilt
Poetry|19|Virgil|The Aeneid|rome troy epic voyage
Poetry|8|Ovid|Metamorphoses|myth transformation
Drama|429|Sophocles|Oedipus Rex|fate thebes tragedy
Drama|441|Sophocles|Antigone|burial law defiance
Drama|431|Euripides|Medea|revenge betrayal tragedy
Drama|458|Aeschylus|Agamemnon|curse house war
Drama|411|Aristophanes|Lysistrata|peace comedy athens
Science|1776|Adam Smith|The Wealth of Nations|economics labor markets
Essays|1848|Karl Marx|The Communist Manifesto|class labor history
History|500|Sun Tzu|The Art of War|strategy war leadership
Science|1632|Galileo Galilei|Dialogue Concerning the Two Chief World Systems|astronomy science
Children's|1902|Rudyard Kipling|Just So Stories|animals origin tales
Adventure|1897|Rudyard Kipling|Captains Courageous|fishing schooner boy sea
Fiction|1894|George du Maurier|Trilby|paris artist hypnosis
Mystery|1908|Gaston Leroux|The Mystery of the Yellow Room|locked room detective
Fiction|1922|Virginia Woolf|Jacob's Room|youth london memory
Poetry|1919|W. B. Yeats|The Wild Swans at Coole|ireland swans poetry
Poetry|1912|Rabindranath Tagore|Gitanjali|devotion poetry songs
Fiction|1920|D. H. Lawrence|The Lost Girl|theatre travel independence
Adventure|1872|Mark Twain|Roughing It|west stagecoach travel
Fiction|1851|Nathaniel Hawthorne|The House of the Seven Gables|curse house new england
Science|1863|Thomas Henry Huxley|Evidence as to Man's Place in Nature|evolution science
Mystery|1911|G. K. Chesterton|The Innocence of Father Brown|detective priest london mystery
Mystery|1914|G. K. Chesterton|The Wisdom of Father Brown|detective priest cases
Fiction|1908|G. K. Chesterton|The Man Who Was Thursday|anarchist london chase
Adventure|1905|Baroness Orczy|The Scarlet Pimpernel|french revolution rescue disguise
Poetry|1876|Lewis Carroll|The Hunting of the Snark|nonsense voyage poetry
History|1513|Niccolo Machiavelli|Discourses on Livy|republic history politics
Fiction|1835|Honore de Balzac|Father Goriot|paris ambition family
Fiction|1833|Honore de Balzac|Eugenie Grandet|province gold family
Fiction|1842|Nikolai Gogol|The Overcoat|clerk coat petersburg
Drama|1836|Nikolai Gogol|The Government Inspector|corruption comedy town
Poetry|1820|Percy Bysshe Shelley|Prometheus Unbound|myth rebellion poetry
Essays|1580|Michel de Montaigne|Essays|self skepticism
Children's|1904|L. Frank Baum|The Marvelous Land of Oz|oz scarecrow adventure
Children's|1907|L. Frank Baum|Ozma of Oz|oz dorothy adventure
History|1848|Thomas Babington Macaulay|The History of England|england history
Science|1904|Marie Curie|Radioactive Substances|radiation science research
Poetry|1821|John Keats|Selected Odes|nightingale urn poetry beauty
Fiction|1891|Oscar Wilde|Lord Arthur Savile's Crime and Other Stories|london wit mystery stories
Adventure|1888|Rudyard Kipling|The Man Who Would Be King|empire mountain adventure
Fiction|1902|Joseph Conrad|Youth, a Narrative|sea voyage youth
Essays|1849|John Ruskin|The Seven Lamps of Architecture|architecture essays art
History|44|Julius Caesar|Commentaries on the Gallic War|rome gaul war
Philosophy|1748|David Hume|An Enquiry Concerning Human Understanding|knowledge skepticism philosophy
Children's|1869|Louisa May Alcott|Good Wives|sisters family sequel
Fiction|1896|H. G. Wells|The Wheels of Chance|cycling holiday england
Adventure|1878|Jules Verne|Dick Sand, a Captain at Fifteen|sea africa adventure
`.trim();

export const seedBooks: SeedBook[] = RAW.split("\n").filter(Boolean).map((line) => {
  const [category, year, author, title, themes, gutenbergId] = line.split("|");
  return {
    category,
    year: Number(year),
    author,
    title,
    themes,
    gutenbergId: gutenbergId ? Number(gutenbergId) : undefined,
  };
});

export function describeBook(book: SeedBook): string {
  return `${book.title} (${book.year}) is a public-domain ${book.category.toLowerCase()} work by ${book.author}. Themes and subjects: ${book.themes}. The downloadable file is an original bibliographic card for this catalog, not a reproduction of the book text.`;
}
