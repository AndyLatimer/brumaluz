import { CLASSES, RACES, classLabel, raceLabel, type CharData } from '../data/data';

export type Language = 'es' | 'en';

const translations: Record<string, string> = {
  'Mundo compartido · {count} jugadores': 'Shared world · {count} players',
  'Conexión al mundo interrumpida. Reintentando…': 'World connection interrupted. Retrying…',
  'Tu cuenta ha entrado al mundo desde otra pestaña o equipo.': 'Your account entered the world from another tab or device.',
  'Sesión de juego cerrada': 'Game session closed',
  'La entrada al mundo se ha cancelado.': 'Entering the world was cancelled.',
  'Respuesta multijugador no válida.': 'Invalid multiplayer response.',
  'El servidor ha rechazado el movimiento del personaje.': 'The server rejected the character movement.',
  'Gráficos: normal': 'Graphics: normal',
  'Gráficos: compatible': 'Graphics: compatibility',
  'Cambiar modo gráfico (recarga la página)': 'Change graphics mode (reloads the page)',
  'Problema con los gráficos': 'Graphics problem',
  'Recargar en modo compatible': 'Reload in compatibility mode',
  'Reintentar': 'Retry',
  'El modo compatible desactiva efectos gráficos avanzados. No cambia tu cuenta ni tus personajes guardados.': 'Compatibility mode disables advanced graphics effects. It does not change your account or saved characters.',
  'Se ha perdido la conexión con la tarjeta gráfica. Recarga el juego o prueba el modo compatible.': 'The connection to the graphics card was lost. Reload the game or try compatibility mode.',
  'La tarjeta gráfica vuelve a responder. Recarga el juego para reconstruir el mundo.': 'The graphics card is responding again. Reload the game to rebuild the world.',
  'No se pudo iniciar WebGL 2. Comprueba la aceleración gráfica de Chrome y el controlador de la tarjeta gráfica.': 'WebGL 2 could not start. Check Chrome graphics acceleration and your graphics card driver.',
  'No se pudo dibujar el mundo 3D. Prueba el modo compatible.': 'The 3D world could not be rendered. Try compatibility mode.',
  'Encendiendo los faroles de Brumaluz…': 'Lighting the lanterns of Brumaluz…',
  'Un nuevo capítulo': 'A New Chapter',
  'Inicia sesión o crea una cuenta para entrar en el mundo de Brumaluz.': 'Sign in or create an account to enter the world of Brumaluz.',
  'Acceso a la cuenta': 'Account access',
  'Idioma': 'Language',
  'Español': 'Spanish',
  'Spanish': 'Español',
  'Iniciar sesión': 'Sign in',
  'Crear cuenta': 'Create account',
  'Recuperar contraseña': 'Reset password',
  'Correo electrónico': 'Email address',
  'Nombre de usuario': 'Username',
  'Nombre de usuario pendiente de asignación': 'Username pending assignment',
  'No se pudo cargar el nombre de usuario': 'Could not load username',
  'El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números o guion bajo.': 'Username must be 3–20 characters: letters, numbers, or underscores.',
  'Ese nombre de usuario ya está en uso. Elige otro.': 'That username is already taken. Choose another.',
  'Contraseña': 'Password',
  'Repite la contraseña': 'Confirm password',
  '¿Olvidaste tu contraseña?': 'Forgot your password?',
  'Te enviaremos un enlace para restablecer la contraseña de tu cuenta.': 'We’ll email you a link to reset your account password.',
  'Enviar enlace': 'Send link',
  'Volver a iniciar sesión': 'Back to sign in',
  'Elige una contraseña nueva para tu cuenta.': 'Choose a new password for your account.',
  'Nueva contraseña': 'New password',
  'Repite la nueva contraseña': 'Confirm new password',
  'Cambiar contraseña': 'Change password',
  'Cerrar sesión': 'Sign out',
  'Tu aventura continúa': 'Your adventure continues',
  'Tus personajes': 'Your characters',
  'Personajes guardados': 'Saved characters',
  'Nivel': 'Level',
  'Cargando…': 'Loading…',
  'Crear personaje': 'Create character',
  'Acción irreversible': 'Irreversible action',
  'Borrar personaje': 'Delete character',
  'Escribe el nombre del personaje para confirmar:': 'Type the character’s name to confirm:',
  'Cancelar': 'Cancel',
  'Borrar definitivamente': 'Delete permanently',
  'Crónicas de Brumaluz': 'Chronicles of Brumaluz',
  'Creación de personaje': 'Character creation',
  'Raza': 'Race',
  'Rostro': 'Face',
  'Cabello': 'Hair',
  'Ropa': 'Clothing',
  'Clase': 'Class',
  'Linaje': 'Ancestry',
  'Atributos': 'Attributes',
  'Sexo': 'Gender',
  'Hombre': 'Male',
  'Mujer': 'Female',
  'Cuerpo': 'Body',
  'Altura': 'Height',
  'Complexión': 'Build',
  'Tono de piel': 'Skin tone',
  'Cara': 'Face shape',
  'Ojos': 'Eyes',
  'Cejas': 'Eyebrows',
  'Nariz': 'Nose',
  'Boca': 'Mouth',
  'Barba': 'Beard',
  'Detalles': 'Details',
  'Maquillaje': 'Makeup',
  'Color del maquillaje': 'Makeup color',
  'Orejas': 'Ears',
  'Peinado': 'Hairstyle',
  'Color de pelo': 'Hair color',
  'Adorno': 'Hair accessory',
  'Color del adorno': 'Hair accessory color',
  'Aquí se muestra el equipo propio de cada clase; comenzarás la aventura con ropa de novato.': 'This shows the unique gear for each class; your adventure begins in novice clothes.',
  'Color principal': 'Primary color',
  'Color secundario': 'Secondary color',
  'Complementos': 'Accessories',
  'Color de complementos': 'Accessory color',
  'Este color se aplica a los complementos de ropa.': 'This color applies to clothing accessories.',
  'Vocación': 'Calling',
  'Volver a tus personajes': 'Back to your characters',
  'Mis personajes': 'My characters',
  'Personaje aleatorio': 'Random character',
  'Aleatorio': 'Random',
  'Saludar': 'Wave',
  'Interactuar / continuar diálogo / reaparecer': 'Interact / continue dialogue / respawn', 'Asomarse al pozo': 'Look into the well',
  '(Te asomas al pozo, es realmente profundo)': '(You lean over the well; it is truly deep)', 'Continuar': 'Continue', 'Aceptar': 'Accept',
  'Hablar': 'Talk', 'Recibir 200 puntos de experiencia': 'Receive 200 experience points', 'Toma, doscientos puntos de experiencia recién impresos. Mira la barra dorada, y si subes de nivel, no me des las gracias.': 'Here, two hundred experience points, freshly printed. Watch the golden bar, and if you level up, do not thank me.', '¡Subes de nivel!': 'Level up!', 'Has caído': 'You have fallen', 'Las luces de Brumaluz titilan, pero no se apagan. Descansa un momento: tu aventura aún no ha terminado.': 'The lights of Brumaluz flicker, but do not go out. Rest a moment: your adventure is not over yet.', 'Reaparecer en la capital': 'Respawn in the capital', 'Recibir 10 puntos de daño': 'Take 10 points of damage', 'Recibir 10 puntos de vida': 'Receive 10 health points', 'Cataplof. Diez puntos de vida, cortesía de la casa. Sin receta ni efectos secundarios.': 'Splosh. Ten health points, on the house. No prescription, no side effects.', 'Pum. Diez puntos de daño, recién salidos del horno. Mira tu barra de vida.': 'Bam. Ten points of damage, fresh out of the oven. Check your health bar.', 'Elegir respuesta en una conversación': 'Choose a reply in a conversation', 'Elegir': 'Choose', 'Salir de la conversación': 'Leave the conversation', 'Hola': 'Hello',
  '¡Saludos, viajero! Soy un NPC de prueba, no tengo lore ni ganas de tenerlo.': 'Greetings, traveller! I am a test NPC, I have no lore and no desire for any.',
  '¡Hola! Si estás leyendo esto, el sistema de conversaciones funciona. Ya me dejas en paz.': 'Hello! If you are reading this, the conversation system works. Now leave me be.',
  'Nombre del personaje': 'Character name',
  'Nombre aleatorio': 'Random name',
  'Guardar y entrar': 'Save and enter',
  'Arrastra para girar · Rueda para acercar': 'Drag to rotate · Scroll to zoom',
  'Abrir menú': 'Open menu',
  'Cerrar menú': 'Close menu',
  'Menú': 'Menu',
  'Selección de personaje': 'Character selection',
  'Salir del juego': 'Log out',
  'Sonido ambiental: activado': 'Ambient sound: on',
  'Sonido ambiental: desactivado': 'Ambient sound: off',
  'No se pudo iniciar el sonido ambiental.': 'Ambient sound could not be started.',
  'Aún no tienes personajes. Crea uno para comenzar tu aventura.': 'You have no characters yet. Create one to begin your adventure.',
  'Jugar': 'Play',
  'Borrar': 'Delete',
  'Ubicación: {location}': 'Location: {location}',
  'Has alcanzado el máximo de {max} personajes por cuenta. Borra uno para crear otro.': 'You’ve reached the limit of {max} characters per account. Delete one to create another.',
  'Puedes tener hasta {max} personajes en tu cuenta.': 'You can have up to {max} characters in your account.',
  'Vas a borrar definitivamente a {name}. Esta acción no se puede deshacer.': 'You are about to permanently delete {name}. This action cannot be undone.',
  'Borrando personaje…': 'Deleting character…',
  'Cargando tus personajes…': 'Loading your characters…',
  'Un momento…': 'One moment…',
  'Tu nombre necesita entre 3 y 16 letras.': 'Your name must be between 3 and 16 letters.',
  'No se pudo guardar': 'Could not save',
  'Las contraseñas no coinciden.': 'Passwords do not match.',
  'Creando tu cuenta…': 'Creating your account…',
  'Iniciando sesión…': 'Signing in…',
  'Cuenta creada. Revisa tu correo para confirmar la dirección y luego inicia sesión.': 'Account created. Check your email to confirm your address, then sign in.',
  'Enviando el enlace…': 'Sending the link…',
  'Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña. Revisa también la carpeta de spam.': 'If an account exists for that email, you’ll receive a password reset link. Check your spam folder too.',
  'El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.': 'This recovery link is invalid or has expired. Request a new one.',
  'Actualizando la contraseña…': 'Updating your password…',
  'Contraseña actualizada correctamente.': 'Password updated successfully.',
  'Cerrando sesión…': 'Signing out…',
  '¡Te damos la bienvenida, {name}!': 'Welcome, {name}!',
  'Tu aventura en Brumaluz comienza ahora.': 'Your adventure in Brumaluz begins now.',
  'Copia .env.example como .env.local, añade los datos del proyecto y reinicia Vite.': 'Copy .env.example to .env.local, add your project credentials, and restart Vite.',
  'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.': 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are missing from .env.local.',
  'Cada cuenta puede tener un máximo de 5 personajes. Borra uno antes de crear otro.': 'Each account can have a maximum of 5 characters. Delete one before creating another.',
  'No se pudo cargar Brumaluz: ': 'Could not load Brumaluz: ',
  'Puntos para repartir: {remaining} de {total}': 'Points to assign: {remaining} of {total}',
  'Base {base} · bonificación racial +{racial} · puntos asignados +{allocated} · máximo {max}': 'Base {base} · ancestry bonus +{racial} · points assigned +{allocated} · maximum {max}',
  'Quitar un punto de {attribute}': 'Remove one point from {attribute}',
  'Añadir un punto a {attribute}': 'Add one point to {attribute}',
  'Puntos por repartir: {n}': 'Points to spend: {n}', 'Confirmar puntos': 'Confirm points', 'Reparte todos tus puntos de atributo antes de empezar.': 'Spend all your attribute points before starting.', '+{n} punto de atributo': '+{n} attribute point', 'Nivel máximo': 'Max level',
  'El color también tiñe las orejas y la cola.': 'The color also tints the ears and tail.',
  'Anterior': 'Previous',
  'Siguiente': 'Next',
  'Base': 'Base',
  'Humana': 'Human', 'Elfa': 'Elf', 'Pelsa': 'Pelso', 'Guerrera': 'Warrior', 'Maga': 'Mage', 'Clériga': 'Cleric', 'Exploradora': 'Ranger',
  'Humano': 'Human',
  'Elfo': 'Elf',
  "Lagto'": "Lagto'",
  'Pelso': 'Pelso',
  'Guerrero': 'Warrior',
  'Mago': 'Mage',
  'Pícaro': 'Rogue',
  'Clérigo': 'Cleric',
  'Explorador': 'Ranger',
  'Fuerza': 'Strength',
  'Intelecto': 'Intellect',
  'Corpulencia': 'Constitution',
  'Agilidad': 'Agility',
  'Pericia': 'Proficiency',
  'Presencia': 'Presence',
  'Percepción': 'Perception',
  'Aumenta el daño general en combate.': 'Increases overall combat damage.',
  'Aumenta la reserva y el poder de la magia.': 'Increases your magic pool and spell power.',
  'Aumenta la vida máxima y la resistencia al daño.': 'Increases maximum health and damage resistance.',
  'Aumenta la velocidad de movimiento y, ligeramente, la velocidad de ataque.': 'Increases movement speed and, slightly, attack speed.',
  'Mejora la artesanía y la alquimia: velocidad de creación y probabilidad de obtener mejores objetos.': 'Improves crafting and alchemy: crafting speed and the chance of getting better items.',
  'Mejora el comercio, la negociación y las interacciones sociales.': 'Improves trade, negotiation, and social interactions.',
  'Ayuda a rastrear, encontrar recursos y descubrir objetos.': 'Helps track, find resources, and discover items.',
  'Nacidos en Brumaluz o llegados de tierras lejanas, los humanos destacan por su ingenio y por encontrar su propio camino en cualquier oficio.': 'Born in Brumaluz or arrived from distant lands, humans are known for their ingenuity and their ability to find their own path in any trade.',
  'Desde hace generaciones, los elfos protegen los bosques que abrazan Brumaluz. Su larga vida y conocimiento de la naturaleza los han convertido en hábiles alquimistas.': 'For generations, elves have protected the forests surrounding Brumaluz. Their long lives and knowledge of nature have made them skilled alchemists.',
  'Los Lagto’ hacen su hogar en montañas pedregosas, entre grietas estrechas y cavernas donde apenas llega la luz. Recios y pacientes, conocen los pasos ocultos de la roca mejor que nadie.': 'The Lagto’ make their home in rocky mountains, among narrow crevices and caves where little light reaches. Hardy and patient, they know the hidden passages in the rock better than anyone.',
  'Los Pelso’ siempre encuentran los rincones más cálidos, aunque rara vez se quedan quietos en ellos. Se dejan guiar por la pasión y el impulso: eso los lleva a vivir intensamente y, a veces, a meterse en líos de los que luego salen con una buena historia.': 'The Pelso’ always find the warmest spots, though they rarely stay still for long. Led by passion and impulse, they live intensely—and sometimes get into trouble they later turn into a good story.',
  'Caballeros, mercenarios o luchadores por cuenta propia: hay muchos caminos para un guerrero. Su honor no está en el título ni en las promesas, sino en las acciones que lleva a cabo.': 'Knights, mercenaries, or independent fighters: there are many paths for a warrior. Their honor lies not in titles or promises, but in their actions.',
  'Los magos buscan comprender las fuerzas que dan forma al mundo. Algunos estudian durante años; otros aprenden a base de probar, fallar y volver a intentarlo. La magia exige curiosidad, disciplina… y aceptar que no siempre sale como uno espera.': 'Mages seek to understand the forces that shape the world. Some study for years; others learn by trying, failing, and trying again. Magic demands curiosity, discipline… and the acceptance that things do not always go as expected.',
  'Los pícaros conocen los atajos, las puertas traseras y el valor de escuchar antes de hablar. Algunos viven del ingenio, otros del sigilo o de saber a quién acudir; todos prefieren tener un plan de salida.': 'Rogues know the shortcuts, the back doors, and the value of listening before speaking. Some rely on wit, others on stealth or knowing whom to ask; all prefer to have an exit plan.',
  'Los clérigos encuentran en la fe una fuente de poder y propósito. Algunos ofrecen consuelo y curación; otros defienden sus creencias con firmeza.': 'Clerics find a source of power and purpose in faith. Some offer comfort and healing; others stand firmly by their beliefs.',
  'Los exploradores se sienten en casa lejos de los caminos transitados. Rastreadores, guías o viajeros solitarios, aprenden a leer el terreno y a arreglárselas con lo que encuentran.': 'Rangers feel at home far from well-travelled roads. Trackers, guides, or solitary wanderers, they learn to read the land and make do with what they find.',
  'Marfil': 'Ivory', 'Melocotón': 'Peach', 'Miel': 'Honey', 'Canela': 'Cinnamon', 'Cacao': 'Cocoa', 'Ébano': 'Ebony',
  'Alba': 'Dawn', 'Pétalo': 'Petal', 'Rosa': 'Rose', 'Lavanda': 'Lavender', 'Crepúsculo': 'Twilight', 'Trigo': 'Wheat',
  'Naranja atigrado': 'Orange tabby', 'Gris atigrado': 'Grey tabby', 'Siamés': 'Siamese', 'Leopardo': 'Leopard', 'Bicolor': 'Bicolor', 'Carey': 'Tortoiseshell', 'Pardo atigrado': 'Brown tabby',
  'Junco': 'Reed', 'Laguna': 'Lagoon', 'Musgo': 'Moss', 'Arena': 'Sand', 'Río': 'River', 'Brasa': 'Ember',
  'Negro': 'Black', 'Castaño': 'Brown', 'Azul': 'Blue', 'Verde': 'Green', 'Ámbar': 'Amber', 'Violeta': 'Violet', 'Rubí': 'Ruby', 'Gris': 'Gray',
  'Azabache': 'Jet black', 'Castaño oscuro': 'Dark brown', 'Cobrizo': 'Auburn', 'Rubio': 'Blonde', 'Pelirrojo': 'Red', 'Plata': 'Silver', 'Grafito': 'Graphite',
  'Carmesí': 'Crimson', 'Azul real': 'Royal blue', 'Bosque': 'Forest', 'Púrpura': 'Purple', 'Oro': 'Gold', 'Carbón': 'Charcoal', 'Lino': 'Linen', 'Turquesa': 'Turquoise', 'Calabaza': 'Pumpkin', 'Fucsia': 'Fuchsia', 'Rosa palo': 'Dusty pink', 'Menta': 'Mint', 'Cielo': 'Sky', 'Crema': 'Cream',
  'Rojo': 'Red', 'Blanco': 'White', 'Lila': 'Lilac',
  'Ninguno': 'None', 'Flor': 'Flower', 'Lazo': 'Ribbon', 'Horquilla de estrella': 'Star pin', 'Corona de flores': 'Flower crown',
  'Pasador metálico': 'Metal hairpin',
  'Broche rúnico': 'Runic brooch',
  'Sin capa': 'No cape', 'Capa corta': 'Short cape', 'Capa de mago': 'Mage cape', 'Capa noble': 'Noble cape', 'Capa de piel': 'Fur cape',
  'Gafas redondas': 'Round glasses', 'Bufanda': 'Scarf', 'Colgante': 'Pendant', 'Pendientes': 'Earrings', 'Monóculo': 'Monocle', 'Gafas y bufanda': 'Glasses and scarf',
  'Pestañas': 'Eyelashes', 'Sombra de ojos': 'Eyeshadow', 'Labios': 'Lip color', 'Sombra y labios': 'Eyeshadow and lips', 'Brillitos': 'Glitter', 'Rabillo gatuno': 'Cat-eye liner',
  'Túnica con capucha': 'Hooded tunic', 'Abrigo de botones': 'Buttoned coat', 'Cota acolchada': 'Padded armor', 'Jubón de cazador': 'Hunter’s jerkin',
  'Guantes de cuero': 'Leather gloves', 'Mangas con puños': 'Cuffed sleeves', 'Guanteletes': 'Gauntlets', 'Mangas con pelo': 'Fur-trimmed sleeves',
  'Calzas y zapatos': 'Trousers and shoes', 'Botas de viaje': 'Travel boots', 'Grebas': 'Greaves', 'Botas de pelo': 'Fur boots',
  'Rapado': 'Shaved', 'Corto con flequillo': 'Short with bangs', 'Despeinado': 'Tousled', 'Media melena': 'Mid-length', 'Coleta': 'Ponytail', 'Moño': 'Bun', 'Dos coletas': 'Twin ponytails', 'Cresta': 'Mohawk', 'Melena larga': 'Long hair', 'Trenza': 'Braid', 'Moños dobles': 'Twin buns', 'Rizos': 'Curls', 'Corte asimétrico': 'Asymmetrical cut', 'Corto pegado': 'Close-cropped',
  'Barba recortada': 'Trimmed beard', 'Barba completa': 'Full beard', 'Perilla y bigote': 'Goatee and mustache', 'Bigote': 'Mustache', 'Perilla': 'Goatee',
  'Normales': 'Normal', 'Grandes': 'Large', 'Pequeños': 'Small', 'Rasgados': 'Narrow', 'Dulces': 'Gentle', 'Soñolientos': 'Sleepy', 'Redondos': 'Round', 'Varoniles': 'Masculine', 'Afilados': 'Sharp',
  'Naturales': 'Natural', 'Finas': 'Thin', 'Gruesas': 'Thick', 'Altas': 'Raised', 'Enfadadas': 'Angry', 'Preocupadas': 'Worried',
  'Pequeña': 'Small', 'Grande': 'Large', 'Respingona': 'Upturned', 'Ancha': 'Wide', 'Aguileña': 'Aquiline', 'Botón': 'Button',
  'Sonrisa': 'Smile', 'Sonrisa abierta': 'Open smile', 'Seria': 'Serious', 'Sorpresa': 'Surprised', 'Pícara': 'Mischievous', 'Colmillo': 'Fang',
  'Rubor': 'Blush', 'Pecas': 'Freckles', 'Cicatriz': 'Scar', 'Pintura de guerra': 'War paint', 'Lunar': 'Beauty mark',
  'Largas': 'Long', 'Cortas': 'Short', 'Caídas': 'Drooping', 'Puntiagudas': 'Pointed', 'Redondas': 'Round', 'Dobladas': 'Folded', 'Púas': 'Spikes', 'Cuernos': 'Horns', 'Aleta': 'Fin', 'Ninguna': 'None',
  'Cresta del linaje': 'Crest',
  'Serio': 'Serious', 'Noble': 'Noble', 'Dulce': 'Sweet', 'Cuadrada': 'Square',
  'Ya tienes un personaje con ese nombre. Elige otro.': 'You already have a character with that name. Choose another.',
  'Correo o contraseña incorrectos.': 'Incorrect email or password.',
  'Confirma tu correo antes de iniciar sesión.': 'Confirm your email before signing in.',
  'Ya existe una cuenta con ese correo.': 'An account with that email already exists.',
  'Ha ocurrido un error inesperado. Inténtalo de nuevo.': 'An unexpected error occurred. Please try again.',
  'Opciones': 'Options', 'Vídeo': 'Video',
  'Placas de nombre': 'Nameplates', 'Mostrar nombre y título sobre el personaje': 'Show name and title above the character',
  'Mostrar placas de nombre': 'Show nameplates', 'Título': 'Title', 'Se muestra bajo tu nombre sobre el personaje.': 'Shown under your name above the character.',
  'Sin título': 'No title', 'Recién llegado': 'Newcomer', 'Rey de Pompelín': 'King of Pompelín', 'Sonido': 'Sound', 'Controles': 'Controls', 'Cerrar': 'Close',
  'Menú de personaje': 'Character menu',
  'Minimapa': 'Minimap', 'Acercar': 'Zoom in', 'Alejar': 'Zoom out', 'Ubicación': 'Location', 'Brumaluz': 'Brumaluz',
  'También con la rueda del ratón sobre el mapa.': 'Also with the mouse wheel over the map.',
  'Lugar actual y coordenadas (este, norte) en metros desde la plaza. º muestra u oculta el minimapa.': 'Current place and coordinates (east, north) in meters from the plaza. º shows or hides the minimap.',
  'Combate': 'Combat', 'Daño, curación y golpes.': 'Damage, healing and hits.',
  '{who} te hace {n} puntos de daño.': '{who} hits you for {n} damage.', '{who} te cura {n} puntos de vida.': '{who} heals you for {n} health.', 'Te curas {n} puntos de vida.': 'You heal for {n} health.',
  'Algo': 'Something', 'Has recibido {n} puntos de experiencia.': 'You received {n} experience points.', '¡Has subido al nivel {n}!': 'You reached level {n}!', 'Has recibido {n} pelines.': 'You received {n} pelines.',
  'Abrir / cerrar el inventario': 'Open / close the inventory', 'Abrir / cerrar la ficha de personaje': 'Open / close the character sheet', 'Abrir / cerrar las opciones': 'Open / close the options',
  'Mostrar / ocultar el minimapa': 'Show / hide the minimap',
  'General': 'General', 'Susurros': 'Whispers', 'NPC': 'NPC',
  'Mensajes de todo el servidor.': 'Messages from the whole server.', 'Mensajes de los jugadores de tu mapa.': 'Messages from players on your map.', 'Mensajes privados entre cuentas.': 'Private messages between accounts.', 'Zona': 'Zone', 'Cuenta': 'Account', 'Canal': 'Channel',
  'Cambia entre General (todo el servidor) y Zona (tu mapa). También /g y /z.': 'Switch between General (whole server) and Zone (your map). Also /g and /z.',
  'Clic para susurrar a su cuenta.': 'Click to whisper to their account.', 'Los susurros van a la cuenta, no al personaje.': 'Whispers go to the account, not the character.',
  'Uso: /w ~cuenta mensaje': 'Usage: /w ~account message', 'Escribes en el canal: {name}.': 'You are now writing in: {name}.',
  'Avisos del juego.': 'Game notices.', 'Lo que dicen los personajes no jugadores.': 'What non-player characters say.',
  'Filtros del chat': 'Chat filters', 'Arrastra para cambiar el tamaño': 'Drag to resize', 'Minimizar chat': 'Minimize chat', 'Abrir chat': 'Open chat',
  'Pulsa Enter para escribir…': 'Press Enter to type…', 'Mensaje de chat': 'Chat message',
  'Susurrar': 'Whisper', 'Susurras a': 'You whisper to', 'te susurra': 'whispers to you', 'dice': 'says',
  'Comandos: /g (general) y /z (zona) cambian de canal o envían un mensaje suelto; /w ~cuenta mensaje (susurrar a una cuenta), /r (responder), /ignore ~cuenta, /unignore ~cuenta, /clear.': 'Commands: /g (general) and /z (zone) switch channel or send a single message; /w ~account message (whisper to an account), /r (reply), /ignore ~account, /unignore ~account, /clear.',
  'Nadie te ha susurrado todavía.': 'Nobody has whispered to you yet.',
  'Ignorados': 'Ignored', 'No ignoras a nadie.': 'You are not ignoring anyone.', 'Ignoras a {name}.': 'You are ignoring {name}.',
  'Ya no ignoras a {name}.': 'You are no longer ignoring {name}.', 'No estabas ignorando a {name}.': 'You were not ignoring {name}.',
  'Comando desconocido: /{name}. Escribe /ayuda.': 'Unknown command: /{name}. Type /help.',
  'Pulsa Enter para chatear. Escribe /ayuda para ver los comandos.': 'Press Enter to chat. Type /help to see the commands.',
  'Modo prueba: el chat no está conectado al servidor.': 'Test mode: chat is not connected to the server.',
  'Los susurros no funcionan en modo prueba.': 'Whispers do not work in test mode.',
  '¿Alguien ha visto mi documentación? Ah, no, no tengo.': 'Has anyone seen my documentation? Oh, right, I have none.',
  'Psst, viajero... ¿quieres probar mis pociones? Son de mentira, pero curan.': 'Psst, traveler... want to try my potions? They are fake, but they heal.',
  'Un día más depurando el universo.': 'Another day debugging the universe.', 'Abrir menú de personaje': 'Open character menu', 'Personaje': 'Character',
  'Inventario': 'Inventory', 'Ficha de personaje': 'Character sheet', 'Habilidades': 'Skills', 'Profesiones': 'Professions',
  'Enciclopedia': 'Encyclopedia', 'Social': 'Social', 'Ayuda': 'Help', 'Próximamente': 'Coming soon',
  'Pelines': 'Pelines', 'Pelín': 'Pelín', 'Lágrimas de fénix': 'Phoenix Tears', 'Lágrima de fénix': 'Phoenix Tear',
  'La moneda corriente de Brumaluz. Sirve para comerciar y pagar servicios.': 'The everyday currency of Brumaluz. Used for trade and services.',
  'Una lágrima de fénix cristalizada, tan rara como valiosa. Con ella se consiguen tesoros y privilegios únicos.': 'A crystallized phoenix tear, as rare as it is valuable. It buys unique treasures and privileges.',
  'Equipo': 'Equipment', 'Anillo': 'Ring',
  'Recibir 100 pelines': 'Receive 100 pelines', 'Comerciar': 'Trade', 'Barra de acceso rápido': 'Quick access bar', 'Hueco vacío': 'Empty slot', 'Arrastra aquí un objeto de la mochila.': 'Drag an item from your backpack here.', 'No te quedan': 'None left', 'Compra más a un vendedor.': 'Buy more from a vendor.', 'Mercancía': 'Wares', 'Comprar': 'Buy', 'Vender': 'Sell', 'Tus objetos': 'Your items',
  'No tienes nada que vender.': 'You have nothing to sell.',
  'Cien pelines calentitos, recién acuñados. No preguntes de dónde salen. Gástalos en mi tienda: «Comerciar».': 'One hundred pelines, hot off the press. Do not ask where they come from. Spend them in my shop: "Trade".',
  'Poción de vida minúscula': 'Minuscule health potion',
  'Un trago diminuto de líquido rojo. Cura un 5 % de tu vida máxima. Haz clic en ella en la mochila para usarla.': 'A tiny sip of red liquid. Heals 5% of your maximum health. Click it in your backpack to use it.',
  'No tienes suficientes pelines.': 'You do not have enough pelines.', 'Tu mochila está llena.': 'Your backpack is full.',
  'Ese vendedor no vende ese objeto.': 'That vendor does not sell that item.', 'Ese personaje no comercia.': 'That character does not trade.',
  'Ese objeto no existe.': 'That item does not exist.', 'Ese objeto no se puede usar.': 'That item cannot be used.', 'Ya tienes la vida completa.': 'Your health is already full.', 'Ranura vacía': 'Empty slot', 'Ampliar mochila': 'Expand backpack',
  'Podrás desbloquear más huecos próximamente.': 'You will be able to unlock more slots soon.', 'Mochila': 'Backpack', 'Monedas': 'Coins', 'monedas': 'coins', 'Tu mochila está vacía por ahora.': 'Your backpack is empty for now.',
  'Cabeza': 'Head', 'Torso': 'Chest', 'Manos': 'Hands', 'Piernas': 'Legs', 'Pies': 'Feet', 'Arma': 'Weapon', 'Mano izquierda': 'Off hand', 'Abalorio': 'Trinket',
  'Abrir / cerrar el menú de personaje': 'Open / close the character menu',
  'Sonido ambiental': 'Ambient sound', 'Volumen ambiental': 'Ambient volume', 'Volumen general': 'Master volume',
  'El volumen general afecta a todos los sonidos del juego, como el combate.': 'Master volume affects every game sound, such as combat.',
  'Movimiento': 'Movement', 'Acciones': 'Actions', 'Cámara': 'Camera', 'Sistema': 'System',
  'Avanzar': 'Move forward', 'Retroceder': 'Move backward', 'Moverse a la izquierda': 'Move left', 'Moverse a la derecha': 'Move right',
  'Mayús': 'Shift', 'Alternar correr / caminar': 'Toggle run / walk', 'Espacio': 'Space', 'Saltar': 'Jump',
  'Abrir / cerrar el menú': 'Open / close the menu', 'Clic': 'Click', 'Arrastrar': 'Drag', 'Rueda': 'Wheel',
  'Ir al punto': 'Go to the spot', 'Mover la cámara': 'Move the camera', 'Acercar / alejar': 'Zoom in / out', 'Girar personaje': 'Rotate character', 'Arrastra para girar a tu personaje.': 'Drag to rotate your character.',
};

const reverseTranslations = new Map(Object.entries(translations).map(([source, translated]) => [translated, source]));
const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();

let language: Language = localStorage.getItem('brumaluz-language') === 'en' ? 'en' : 'es';

export function getLanguage() {
  return language;
}

export function setLanguage(next: Language) {
  language = next;
  localStorage.setItem('brumaluz-language', next);
  applyLanguage(document);
  document.dispatchEvent(new CustomEvent('brumaluz-language-change', { detail: next }));
}

export function t(source: string, values: Record<string, string | number> = {}) {
  let translated = language === 'en'
    ? translations[source] ?? source
    : reverseTranslations.get(source) ?? source;
  for (const [key, value] of Object.entries(values)) translated = translated.replaceAll(`{${key}}`, String(value));
  return translated;
}

/** Raza y clase con el género del personaje; en inglés no hay distinción de género. */
export const raceText = (d: Pick<CharData, 'race' | 'sex'>) => (language === 'en' ? t(RACES[d.race].label) : raceLabel(d));
export const classText = (d: Pick<CharData, 'cls' | 'sex'>) => (language === 'en' ? t(CLASSES[d.cls].label) : classLabel(d));

export function applyLanguage(root: ParentNode) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const source = textSources.get(text) ?? reverseTranslations.get(text.data.trim()) ?? text.data;
    textSources.set(text, source);
    const translated = language === 'en' ? translations[source.trim()] : reverseTranslations.get(source.trim());
    if (translated) {
      const leading = source.match(/^\s*/)?.[0] ?? '';
      const trailing = source.match(/\s*$/)?.[0] ?? '';
      text.data = `${leading}${translated}${trailing}`;
    } else if (language === 'es') {
      text.data = source;
    }
  }
  const elements = root instanceof Document ? root.querySelectorAll('*') : root.querySelectorAll('*');
  for (const element of elements) {
    const sources = attributeSources.get(element) ?? new Map<string, string>();
    for (const attribute of ['title', 'placeholder', 'aria-label', 'aria-description']) {
      const value = element.getAttribute(attribute);
      if (value === null) continue;
      const source = sources.get(attribute) ?? value;
      sources.set(attribute, source);
      const translated = language === 'en' ? translations[source] : reverseTranslations.get(source);
      if (translated) element.setAttribute(attribute, translated);
      else if (language === 'es') element.setAttribute(attribute, source);
    }
    attributeSources.set(element, sources);
  }
}
