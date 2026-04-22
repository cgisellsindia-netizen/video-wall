package com.camigo.deliverypartner;

import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private FrameLayout splashOverlay;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showAnimatedSplash();
    }

    private void showAnimatedSplash() {
        splashOverlay = new FrameLayout(this);
        splashOverlay.setBackgroundColor(0xFFFFFFFF);

        ImageView logo = new ImageView(this);
        logo.setImageResource(getResources().getIdentifier("splash_logo", "drawable", getPackageName()));
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setScaleX(0.84f);
        logo.setScaleY(0.84f);
        logo.setAlpha(0f);

        int size = (int) (220 * getResources().getDisplayMetrics().density);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(size, size, Gravity.CENTER);
        splashOverlay.addView(logo, logoParams);

        addContentView(splashOverlay, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        logo.animate()
                .alpha(1f)
                .scaleX(1f)
                .scaleY(1f)
                .setDuration(520)
                .setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(() -> splashOverlay.postDelayed(() -> {
                    if (splashOverlay == null) return;
                    splashOverlay.animate()
                            .alpha(0f)
                            .setDuration(360)
                            .withEndAction(() -> {
                                ViewGroup parent = (ViewGroup) splashOverlay.getParent();
                                if (parent != null) parent.removeView(splashOverlay);
                                splashOverlay = null;
                            })
                            .start();
                }, 650))
                .start();
    }
}
