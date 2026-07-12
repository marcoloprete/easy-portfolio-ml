<?php
/**
 * Plugin Name: Easy Portfolio ML
 * Description: Un semplice plugin per creare un portfolio di immagini con titoli e link associati.
 * Version: 1.0
 * Author: Marco Loprete
 * License: GPL2
 */

// Registra il nuovo custom post type
function easy_portfolio_register_post_type() {
    $labels = array(
        'name' => 'Portfolio Siti',
        'singular_name' => 'Portfolio Sito',
    );

    $args = array(
        'labels' => $labels,
        'public' => true,
        'supports' => array('title', 'thumbnail'),
        'menu_icon' => 'dashicons-format-gallery',
        'taxonomies' => array('post_tag'), 
    );

    register_post_type('portfolio_sito', $args);
}
add_action('init', 'easy_portfolio_register_post_type');

// Aggiungi metabox link per l'elemento portfolio
function easy_portfolio_add_link_metabox() {
    add_meta_box(
        'portfolio_sito_link',
        'Portfolio Sito Link',
        'easy_portfolio_link_metabox_callback',
        'portfolio_sito',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'easy_portfolio_add_link_metabox');

function easy_portfolio_link_metabox_callback($post) {
    $link = get_post_meta($post->ID, '_portfolio_sito_link', true);
    wp_nonce_field( 'easy_portfolio_save_link', 'easy_portfolio_link_nonce' );
    ?>
    <label for="portfolio_sito_link">Link:</label>
    <input type="url" id="portfolio_sito_link" name="portfolio_sito_link" value="<?php echo esc_attr($link); ?>">
    <?php
}

// Salva il link quando l'elemento portfolio viene salvato
function easy_portfolio_save_link($post_id) {
    if ( get_post_type( $post_id ) !== 'portfolio_sito' ) {
        return;
    }

    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
        return;
    }
    if ( wp_is_post_revision( $post_id ) ) {
        return;
    }

    if ( ! current_user_can( 'edit_post', $post_id ) ) {
        return;
    }

    if ( ! isset( $_POST['easy_portfolio_link_nonce'] ) || ! wp_verify_nonce( $_POST['easy_portfolio_link_nonce'], 'easy_portfolio_save_link' ) ) {
        return;
    }

    if ( isset( $_POST['portfolio_sito_link'] ) ) {
        update_post_meta(
            $post_id,
            '_portfolio_sito_link',
            esc_url_raw( wp_unslash( $_POST['portfolio_sito_link'] ) )
        );
    }
}

function easy_portfolio_ml_enqueue_assets() {
    $css_path  = plugin_dir_path(__FILE__) . 'css/easy-portfolio-ml.min.css';
    $css_url   = plugin_dir_url(__FILE__) . 'css/easy-portfolio-ml.min.css';

    if ( file_exists( $css_path ) ) {
        wp_enqueue_style(
            'easy-portfolio-styles',
            $css_url,
            array(),
            filemtime( $css_path )
        );
    }

    $base_js_path = plugin_dir_path(__FILE__) . 'js/easy-portfolio-ml.min.js';
    $base_js_url  = plugin_dir_url(__FILE__) . 'js/easy-portfolio-ml.min.js';

    if ( file_exists( $base_js_path ) ) {
        wp_enqueue_script(
            'easy-portfolio-js',
            $base_js_url,
            array(),
            filemtime( $base_js_path ),
            true
        );
    }

    $slick_css_path       = plugin_dir_path(__FILE__) . 'css/vendor/slick/slick.css';
    $slick_css_url        = plugin_dir_url(__FILE__) . 'css/vendor/slick/slick.css';
    $slick_theme_css_path = plugin_dir_path(__FILE__) . 'css/vendor/slick/slick-theme.css';
    $slick_theme_css_url  = plugin_dir_url(__FILE__) . 'css/vendor/slick/slick-theme.css';
    $slick_js_path        = plugin_dir_path(__FILE__) . 'js/vendor/slick/slick.min.js';
    $slick_js_url         = plugin_dir_url(__FILE__) . 'js/vendor/slick/slick.min.js';

    if ( file_exists( $slick_css_path ) ) {
        wp_enqueue_style(
            'easy-portfolio-slick',
            $slick_css_url,
            array(),
            filemtime( $slick_css_path )
        );
    }

    if ( file_exists( $slick_theme_css_path ) ) {
        wp_enqueue_style(
            'easy-portfolio-slick-theme',
            $slick_theme_css_url,
            array( 'easy-portfolio-slick' ),
            filemtime( $slick_theme_css_path )
        );
    }

    if ( file_exists( $slick_js_path ) ) {
        wp_enqueue_script(
            'easy-portfolio-slick',
            $slick_js_url,
            array( 'jquery' ),
            filemtime( $slick_js_path ),
            true
        );

        $slick_init = <<<'JS'
jQuery(function($){
  var $sliders = $('.easy-portfolio-slider');

  $sliders.each(function(){
    var $el = $(this);
    if ($el.hasClass('slick-initialized')) return;

    $el.slick({
      dots: true,
      arrows: true,
      infinite: false,
      speed: 300,
      slidesToShow: 4,
      slidesToScroll: 4,
      responsive: [
        {
          breakpoint: 1801,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 3,
            infinite: false,
            dots: true,
            arrows: true
          }
        },
        {
          breakpoint: 1024,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 3,
            infinite: false,
            dots: true,
            arrows: true
          }
        },
        {
          breakpoint: 768,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1,
            infinite: false,
            dots: true,
            arrows: true
          }
        }
      ]
    });
  });
});
JS;

        wp_add_inline_script( 'easy-portfolio-slick', $slick_init );
    }
}

function easy_portfolio_ml_slider_shortcode( $atts ) {
    easy_portfolio_ml_enqueue_assets();

    $attributes = shortcode_atts(
        array(
            'tag'        => '',
            'fullwidth'  => '1',
            'peek'       => '80',
            'title'      => '',
            'title_break'=> '1',
            'title_main' => '',
            'title_gray' => '',
        ),
        $atts
    );

    $fullwidth = (string) $attributes['fullwidth'] === '1';
    $peek      = is_numeric( $attributes['peek'] ) ? (int) $attributes['peek'] : 80;

    // Titolo sezione (stessa logica di ml_webdesign_grid)
    $title_main  = $attributes['title_main'];
    $title_gray  = $attributes['title_gray'];
    $title_break = (string) $attributes['title_break'] === '1';

    if ( ! empty( $attributes['title'] ) ) {
        $parts = explode( '|', $attributes['title'] );
        if ( $title_main === '' && isset( $parts[0] ) ) {
            $title_main = trim( $parts[0] );
        }
        if ( $title_gray === '' && isset( $parts[1] ) ) {
            $title_gray = trim( $parts[1] );
        }
    }

    $has_title = ( $title_main !== '' || $title_gray !== '' );

    $args = array(
        'post_type'      => 'portfolio_sito',
        'posts_per_page' => -1,
    );

    if ( ! empty( $attributes['tag'] ) ) {
        $tag_slug = sanitize_text_field( $attributes['tag'] );
        $args['tax_query'] = array(
            array(
                'taxonomy' => 'post_tag',
                'field'    => 'slug',
                'terms'    => array( $tag_slug ),
            ),
        );
    }

    $query  = new WP_Query( $args );
    $output = '';

    if ( $query->have_posts() ) {
        $wrapper_classes = array( 'easy-portfolio-slider-wrapper', 'is-carousel' );
        if ( $fullwidth ) {
            $wrapper_classes[] = 'is-fullwidth';
        }

        $output .= '<section class="easy-portfolio-section">';

        if ( $has_title || ! $fullwidth ) {
            $output .= '<div class="easy-portfolio-section__inner">';
        }

        if ( $has_title ) {
            $output .= '<div class="easy-portfolio-heading-container">';
            $output .= '<div class="easy-portfolio-heading">';
            $output .= '<h2 class="easy-portfolio-heading__title">';
            if ( $title_main !== '' ) {
                $output .= '<span class="easy-portfolio-heading__main">' . esc_html( $title_main ) . '</span>';
            }

            if ( $title_break && $title_main !== '' && $title_gray !== '' ) {
                $output .= '<br>';
            }

            if ( $title_gray !== '' ) {
                $output .= '<span class="ml-heading-gray">' . esc_html( $title_gray ) . '</span>';
            }

            $output .= '</h2>';
            $output .= '</div>';
            $output .= '</div>';
        }

        if ( $fullwidth && $has_title ) {
            $output .= '</div>';
        }

        $output .= '<div class="' . esc_attr( implode( ' ', $wrapper_classes ) ) . '">';
        $output .= '<div class="easy-portfolio-slider is-carousel" data-layout="carousel" data-peek="' . esc_attr( (string) $peek ) . '">';

        if ( $fullwidth ) {
            $inline_css  = '.easy-portfolio-slider-wrapper.is-fullwidth{width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);overflow:hidden;}';
            $inline_css .= '.easy-portfolio-slider-wrapper.is-fullwidth .easy-portfolio-slider{padding-left:' . $peek . 'px;padding-right:' . $peek . 'px;}';
            wp_add_inline_style( 'easy-portfolio-styles', $inline_css );
        }

        while ( $query->have_posts() ) {
            $query->the_post();
            $id        = get_the_ID();
            $title     = get_the_title();
            $thumbnail = get_the_post_thumbnail( $id, 'full' );
            $link      = get_post_meta( $id, '_portfolio_sito_link', true );

            $output .= '<div class="easy-portfolio-slide">';

            if ( ! empty( $link ) ) {
                $output .= '<a href="' . esc_url( $link ) . '" target="_blank" rel="noopener noreferrer">';
            }

            $output .= '<div class="easy-portfolio-image">' . $thumbnail . '</div>';
            $output .= '<div class="easy-portfolio-title">' . esc_html( $title ) . '</div>';

            if ( ! empty( $link ) ) {
                $output .= '</a>';
            }

            $output .= '</div>';
        }

        $output .= '</div>';
        $output .= '</div>';

        if ( ! $fullwidth ) {
            $output .= '</div>';
        }

        $output .= '</section>';

        wp_reset_postdata();
    }

    return $output;
}

add_shortcode('easy-portfolio', 'easy_portfolio_ml_slider_shortcode');
add_shortcode('easy-portfolio-slider', 'easy_portfolio_ml_slider_shortcode');
